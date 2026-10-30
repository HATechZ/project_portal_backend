import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Persistence boundary for the post-cutover, pair-private route channel.
 * There is intentionally no reference to the historical V1/C2 info tables. */
@Injectable()
export class WorkRequestCommunicationRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) { super(uow); }

  route(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestRoute.findFirst({
      where: { tenantId, workRequestId },
      include: {
        responsibleOriginatingLead: {
          select: {
            memberId: true,
            revokedAt: true,
            member: { select: { isActive: true } },
            division: { select: { isActive: true } },
          },
        },
        steps: { select: { id: true, divisionId: true, ordinal: true, kind: true } },
        projection: true,
        divisionCycles: { include: { routeStep: { select: { divisionId: true } }, teamSteps: { include: { team: { select: { leadMemberId: true } }, memberSteps: { select: { memberId: true, activatedAt: true, submittedAt: true } } } } } },
      },
    }));
  }

  async isRelatedActor(workRequestId: string, memberId: string) {
    const route: any = await this.route(workRequestId);
    if (!route) return null;
    if (route.responsibleOriginatingLead.memberId === memberId) return true;
    const routeDivisionIds = route.steps.map((step: any) => step.divisionId).filter(Boolean);
    const lead = await this.transaction((db) => db.divisionLead.findFirst({ where: { tenantId: RequestContext.requireTenantId(), memberId, divisionId: { in: routeDivisionIds }, revokedAt: null }, select: { id: true } }));
    if (lead) return true;
    for (const cycle of route.divisionCycles)
      for (const team of cycle.teamSteps)
        if (team.team.leadMemberId === memberId || team.memberSteps.some((step: any) => step.memberId === memberId)) return true;
    // A former pair participant has the deliberately narrower exception in
    // `conversation`: it does not make that actor related to live/main or
    // internal route projections.
    return false;
  }

  async recipientActorIds(workRequestId: string, actorId: string, memberId: string) {
    const tenantId = RequestContext.requireTenantId();
    const route: any = await this.route(workRequestId);
    if (!route) return null;
    const projection = route.projection;
    const cycle = route.divisionCycles.find((item: any) => item.id === projection?.divisionCycleId && !item.completedAt);
    if (!cycle) return [];
    const currentTeam = cycle.teamSteps.find((item: any) => item.id === projection.teamStepId && item.activatedAt && !item.completedAt);
    const memberStep = currentTeam?.memberSteps.find((item: any) => item.memberId === memberId);
    const routeDivisionIds = route.steps.map((step: any) => step.divisionId).filter(Boolean);
    const leads = await this.transaction((db) => db.divisionLead.findMany({ where: { tenantId, memberId, revokedAt: null, divisionId: { in: routeDivisionIds } }, select: { divisionId: true } }));
    const ledDivisions = new Set(leads.map((lead) => lead.divisionId));
    const recipients = new Set<string>();
    if (memberStep && currentTeam) {
      if (currentTeam.team.leadMemberId) recipients.add(currentTeam.team.leadMemberId);
      for (const step of currentTeam.memberSteps) if (step.memberId !== memberId) recipients.add(step.memberId);
    }
    if (currentTeam?.team.leadMemberId === memberId) {
      for (const step of currentTeam.memberSteps) if (step.memberId !== memberId) recipients.add(step.memberId);
      const divisionLeads = await this.activeDivisionLeadMembers([cycle.routeStep.divisionId]);
      divisionLeads.forEach((id) => recipients.add(id));
      for (const step of cycle.teamSteps) if (step.id !== currentTeam.id && step.team.leadMemberId) recipients.add(step.team.leadMemberId);
    }
    if (ledDivisions.has(cycle.routeStep.divisionId)) {
      for (const step of cycle.teamSteps) if (step.team.leadMemberId && step.team.leadMemberId !== memberId) recipients.add(step.team.leadMemberId);
      const divisionLeads = await this.activeDivisionLeadMembers(routeDivisionIds);
      divisionLeads.forEach((id) => { if (id !== memberId) recipients.add(id); });
    }
    if (!recipients.size) return [];
    const actors = await this.transaction((db) => db.actorProfile.findMany({ where: { tenantId, memberId: { in: [...recipients] }, isActive: true }, select: { id: true, memberId: true, label: true } }));
    return actors.filter((actor) => actor.id !== actorId);
  }

  private activeDivisionLeadMembers(divisionIds: (string | null)[]) {
    const tenantId = RequestContext.requireTenantId();
    const ids = divisionIds.filter((id): id is string => !!id);
    return this.transaction(async (db) => (await db.divisionLead.findMany({ where: { tenantId, divisionId: { in: ids }, revokedAt: null, member: { is: { isActive: true } } }, select: { memberId: true } })).map((item) => item.memberId));
  }

  hasDocumentVersions(workRequestId: string, ids: string[]) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => (await db.workRequestV1DocumentVersion.count({ where: { tenantId, id: { in: ids }, document: { workRequestId } } })) === ids.length);
  }

  async send(workRequestId: string, senderActorId: string, recipientActorIds: string[], body: string, documentVersionIds: string[], idempotencyKey?: string, correlationId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, select: { id: true } });
      if (!route) return null;
      const messages = [] as any[];
      for (const recipientActorId of recipientActorIds) {
        const [firstParticipantActorId, secondParticipantActorId] = [senderActorId, recipientActorId].sort();
        const key = idempotencyKey ? `${idempotencyKey}:${recipientActorId}`.slice(0, 160) : undefined;
        const existing = key && await db.workRequestRouteMessage.findFirst({ where: { tenantId, workRequestId, idempotencyKey: key }, include: { attachments: { select: { documentVersionId: true } } } });
        if (existing) { messages.push(existing); continue; }
        let conversation = await db.workRequestRouteConversation.findFirst({ where: { tenantId, workRequestId, firstParticipantActorId, secondParticipantActorId }, select: { id: true } });
        if (!conversation) conversation = await db.workRequestRouteConversation.create({ data: { id: randomUUID(), tenantId, routeId: route.id, workRequestId, firstParticipantActorId, secondParticipantActorId }, select: { id: true } });
        const prior = await db.workRequestRouteMessage.findFirst({ where: { tenantId, conversationId: conversation.id }, orderBy: { sequenceNumber: 'desc' }, select: { sequenceNumber: true } });
        messages.push(await db.workRequestRouteMessage.create({ data: { id: randomUUID(), tenantId, routeId: route.id, workRequestId, conversationId: conversation.id, sequenceNumber: (prior?.sequenceNumber ?? 0) + 1, senderActorId, recipientActorId, body, idempotencyKey: key, correlationId, attachments: { create: documentVersionIds.map((documentVersionId) => ({ id: randomUUID(), tenantId, routeId: route.id, workRequestId, documentVersionId })) } }, include: { attachments: { select: { documentVersionId: true } } } }));
      }
      return messages;
    }, { isolationLevel: 'Serializable' });
  }

  conversation(workRequestId: string, conversationId: string, actorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestRouteConversation.findFirst({ where: { id: conversationId, tenantId, workRequestId, OR: [{ firstParticipantActorId: actorId }, { secondParticipantActorId: actorId }] }, include: { messages: { orderBy: [{ sequenceNumber: 'asc' }, { id: 'asc' }], include: { attachments: { select: { documentVersionId: true } } } } } }));
  }

  history(workRequestId: string, actorId: string, internal: boolean) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route: any = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, include: { projection: true, steps: { select: { id: true, ordinal: true, kind: true, divisionId: true, activatedAt: true, completedAt: true } } } });
      if (!route) return null;
      return internal
        ? {
            projection: route.projection,
            steps: route.steps,
            events: await db.workRequestRouteEvent.findMany({
              where: { tenantId, routeId: route.id },
              orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
              select: { id: true, action: true, occurredAt: true, routeStepId: true, divisionCycleId: true, teamStepId: true, memberStepId: true },
            }),
          }
        : {
            projection: route.projection
              ? { routeVersionId: route.projection.routeVersionId, routeStepId: route.projection.routeStepId, updatedAt: route.projection.updatedAt }
              : null,
            steps: route.steps,
          };
    });
  }
}
