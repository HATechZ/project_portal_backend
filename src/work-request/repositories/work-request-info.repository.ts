import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  InfoRequestStatusCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { workRequestVisibilityWhere } from '../../common/security/work-request-visibility';
import type { SessionActor } from '../../common/security/session.types';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  type WorkRequestInfoSnapshot,
  workRequestInfoHistorySelect,
  workRequestInfoSelect,
  workRequestInfoTargetSelect,
} from './work-request-info.records';

@Injectable()
export class WorkRequestInfoRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  isRouteWorkRequest(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestRoute.findFirst({
        where: { tenantId, workRequestId },
        select: { id: true },
      }),
    );
  }

  isVisible(workRequestId: string, actor: SessionActor) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => !!(await db.workRequestV1.findFirst({
      where: { id: workRequestId, tenantId, ...workRequestVisibilityWhere(actor) },
      select: { id: true },
    })));
  }

  async prepare(
    workRequestId: string,
    targetActorId?: string,
    infoRequestId?: string,
  ): Promise<WorkRequestInfoSnapshot | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: workRequestInfoSelect,
      });
      if (!request) return null;
      const target = targetActorId
        ? await db.actorProfile.findFirst({
            where: { id: targetActorId, tenantId, isActive: true, user: { is: { isActive: true } } },
            select: workRequestInfoTargetSelect(),
          })
        : null;
      const info = infoRequestId
        ? await db.workRequestV1InfoRequest.findFirst({
            where: { id: infoRequestId, tenantId, workRequestId },
            select: { requestedByActorId: true, targetActorId: true },
          })
        : null;
      const parent = request.bid ?? request.directProject;
      return { request, target, parent, info };
    });
  }

  eligibleRecipients(workRequestId: string, requesterActorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          bid: { select: { clientId: true, client: { select: { companyId: true } } } },
          directProject: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          route: {
            select: {
              originatingDivisionId: true,
              responsibleOriginatingLead: {
                select: {
                  memberId: true,
                  revokedAt: true,
                  member: { select: { isActive: true } },
                  division: { select: { isActive: true } },
                },
              },
              projection: { select: { divisionCycleId: true } },
              divisionCycles: {
                where: { completedAt: null },
                select: {
                  id: true,
                  routeStep: { select: { divisionId: true } },
                  teamSteps: {
                    select: {
                      teamId: true,
                      team: { select: { divisionId: true, leadMemberId: true, isActive: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!request) return null;
      const parent = request.bid ?? request.directProject;
      if (!parent?.client.companyId) return null;
      const requester = await db.actorProfile.findFirst({
        where: { id: requesterActorId, tenantId, isActive: true, user: { is: { isActive: true } } },
        select: { id: true, memberId: true, clientContactId: true },
      });
      if (!requester) return [];

      const route: any = request.route;
      const activeCycle = route?.divisionCycles.find(
        (cycle: any) => cycle.id === route.projection?.divisionCycleId,
      );
      const activeDivisionId = activeCycle?.routeStep.divisionId;
      const activeTeamSteps = activeCycle?.teamSteps.filter(
        (step: any) => step.team.isActive,
      ) ?? [];
      const teamIds = activeTeamSteps.map((step: any) => step.teamId);
      const ledTeamSteps = requester.memberId
        ? activeTeamSteps.filter((step: any) => step.team.leadMemberId === requester.memberId)
        : [];
      const memberTeamIds = requester.memberId && teamIds.length
        ? (await db.workRequestMemberStep.findMany({
            where: {
              tenantId,
              route: { is: { workRequestId } },
              memberId: requester.memberId,
              teamStep: { divisionCycleId: activeCycle?.id },
            },
            select: { teamStep: { select: { teamId: true } } },
          })).map((step: any) => step.teamStep.teamId)
        : [];
      const origin = !!(
        requester.memberId && route?.responsibleOriginatingLead &&
        route.responsibleOriginatingLead.memberId === requester.memberId &&
        route.responsibleOriginatingLead.revokedAt === null &&
        route.responsibleOriginatingLead.member.isActive &&
        route.responsibleOriginatingLead.division.isActive
      );
      const isActiveDivisionLead = !!(requester.memberId && activeDivisionId &&
        await db.divisionLead.findFirst({
          where: { tenantId, memberId: requester.memberId, divisionId: activeDivisionId, revokedAt: null, member: { is: { isActive: true } }, division: { is: { isActive: true } } },
          select: { id: true },
        }));

      const memberIds = new Set<string>();
      let includeClientContacts = false;
      if (origin) {
        includeClientContacts = true;
        (await activeDivisionLeadMembers(db, tenantId, parent.client.companyId)).forEach((id: string) => memberIds.add(id));
      } else if (isActiveDivisionLead) {
        for (const step of activeTeamSteps)
          if (step.team.divisionId === activeDivisionId && step.team.leadMemberId)
            memberIds.add(step.team.leadMemberId);
        (await activeDivisionLeadMembers(db, tenantId, parent.client.companyId)).forEach((id: string) => memberIds.add(id));
      } else if (ledTeamSteps.length) {
        const divisionIds = [...new Set<string>(ledTeamSteps.map((step: any) => step.team.divisionId))];
        for (const divisionId of divisionIds)
          (await activeDivisionLeadMembers(db, tenantId, parent.client.companyId, [divisionId])).forEach((id: string) => memberIds.add(id));
        for (const step of activeTeamSteps)
          if (divisionIds.includes(step.team.divisionId) && step.team.leadMemberId)
            memberIds.add(step.team.leadMemberId);
        (await activeTeamMemberIds(db, tenantId, ledTeamSteps.map((step: any) => step.teamId))).forEach((id: string) => memberIds.add(id));
      } else if (memberTeamIds.length) {
        const ownTeamIds = [...new Set(memberTeamIds)];
        for (const step of activeTeamSteps)
          if (ownTeamIds.includes(step.teamId) && step.team.leadMemberId)
            memberIds.add(step.team.leadMemberId);
        (await activeTeamMemberIds(db, tenantId, ownTeamIds)).forEach((id: string) => memberIds.add(id));
      }

      // A persisted pair is a narrowly-scoped reciprocal edge.  It augments
      // only this Work Request's exact counterpart; it never expands a role's
      // normal matrix or exposes unrelated people.
      const reciprocal = await db.workRequestV1InfoRequest.findMany({
        where: {
          tenantId,
          workRequestId,
          OR: [
            { requestedByActorId: requesterActorId },
            { targetActorId: requesterActorId },
          ],
        },
        select: { requestedByActorId: true, targetActorId: true },
      });
      const reciprocalActorIds = reciprocal.map((item: any) =>
        item.requestedByActorId === requesterActorId ? item.targetActorId : item.requestedByActorId,
      );

      if (requester.memberId) memberIds.delete(requester.memberId);

      const internal = memberIds.size
        ? await recipientProfiles(db, tenantId, parent.client.companyId, [...memberIds], requesterActorId)
        : [];
      const contacts = includeClientContacts
        ? await clientRecipientProfiles(db, tenantId, parent.clientId, requesterActorId)
        : [];
      const reciprocalProfiles = reciprocalActorIds.length
        ? await activeProfiles(db, tenantId, parent.client.companyId, reciprocalActorIds, requesterActorId)
        : [];
      return dedupeProfiles([...internal, ...contacts, ...reciprocalProfiles]);
    });
  }

  hasInfoRelationship(workRequestId: string, actorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) => db.workRequestV1InfoRequest.findFirst({
      where: { tenantId, workRequestId, OR: [{ requestedByActorId: actorId }, { targetActorId: actorId }] },
      select: { id: true },
    }));
  }

  async isActiveRouteLead(workRequestId: string, memberId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route = await this.routeDivisions(db, workRequestId);
      if (!route) return false;
      return !!(await db.divisionLead.findFirst({ where: {
        tenantId, memberId, divisionId: { in: route.divisionIds }, revokedAt: null,
        division: { is: { isActive: true } }, member: { is: { isActive: true } },
      }, select: { id: true } }));
    });
  }

  private async routeDivisions(db: import('../../infra/prisma/prisma-executor.type').PrismaExecutor, workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    const route = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, select: {
      originatingDivisionId: true,
      responsibleOriginatingLead: { select: { memberId: true, revokedAt: true, member: { select: { isActive: true } }, division: { select: { isActive: true } } } },
      projection: { select: { routeVersionId: true, routeStepId: true } },
      steps: { select: { id: true, routeVersionId: true, divisionId: true, activatedAt: true } },
    } });
    if (!route) return null;
    const lead = route.responsibleOriginatingLead;
    const divisionIds = new Set([route.originatingDivisionId]);
    for (const step of route.steps) {
      if (step.divisionId && (step.activatedAt || step.id === route.projection?.routeStepId || (route.projection?.routeVersionId && step.routeVersionId === route.projection.routeVersionId)))
        divisionIds.add(step.divisionId);
    }
    return { divisionIds: [...divisionIds], responsibleMemberId: lead.memberId, responsibleActive: lead.revokedAt === null && lead.member.isActive && lead.division.isActive };
  }

  clientRecipientStatus(workRequestId: string, requesterActorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({ where: { id: workRequestId, tenantId }, select: {
        bid: { select: { clientId: true } }, directProject: { select: { clientId: true } },
      } });
      const clientId = request?.bid?.clientId ?? request?.directProject?.clientId;
      if (!clientId) return null;
      const route = await db.workRequestRoute.findFirst({ where: { tenantId, workRequestId }, select: { responsibleOriginatingLead: { select: { memberId: true, revokedAt: true } } } });
      const requester = await db.actorProfile.findFirst({ where: { tenantId, id: requesterActorId, isActive: true }, select: { memberId: true } });
      if (!route?.responsibleOriginatingLead || route.responsibleOriginatingLead.revokedAt !== null || route.responsibleOriginatingLead.memberId !== requester?.memberId)
        return { activeContacts: 0, contactsWithActiveDefaultProfile: 0, unavailableContacts: [] };
      const contacts = await db.clientContact.findMany({ where: { tenantId, clientId, isActive: true, client: { is: { isActive: true } } }, select: {
        id: true, name: true, client: { select: { id: true, name: true } },
        actorProfilesByClientContactId: { where: { isActive: true, isDefault: true, user: { is: { isActive: true } } }, select: { id: true } },
      } });
      return { activeContacts: contacts.length, contactsWithActiveDefaultProfile: contacts.filter((contact) => contact.actorProfilesByClientContactId.length > 0).length,
        unavailableContacts: contacts.filter((contact) => !contact.actorProfilesByClientContactId.length).map((contact) => ({ contactId: contact.id, displayName: contact.name, recipientType: 'EXTERNAL_CLIENT_CONTACT', contextType: 'CLIENT_CONTACT', context: contact.client, canReceive: false, canRespond: false, unavailableReason: 'Client contact unavailable — portal access/profile not configured' })) };
    });
  }

  create(input: {
    workRequestId: string;
    requestedByActorId: string;
    targetActorId: string;
    message: string;
    stateAtRequest: WorkRequestV1StateCode;
    parentInfoRequestId?: string;
    documentVersionIds?: string[];
    idempotencyKey?: string;
    correlationId?: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      if (input.parentInfoRequestId) {
        const parent = await db.workRequestV1InfoRequest.findFirst({
          where: {
            id: input.parentInfoRequestId,
            tenantId,
            workRequestId: input.workRequestId,
            status: InfoRequestStatusCode.OPEN,
          },
          select: { requestedByActorId: true, targetActorId: true },
        });
        if (!parent) throw new Error('INFO_PARENT');
        if (
          input.requestedByActorId !== parent.requestedByActorId &&
          input.requestedByActorId !== parent.targetActorId
        )
          throw new Error('INFO_PARENT_PARTICIPANT');
      }
      const existing = input.idempotencyKey
        ? await db.workRequestV1InfoRequest.findFirst({
            where: { tenantId, idempotencyKey: input.idempotencyKey },
            select: workRequestInfoHistorySelect,
          })
        : null;
      if (existing) return { request: existing, duplicate: true };
      const requestId = randomUUID();
      await db.workRequestV1InfoRequest.create({
        data: {
          id: requestId,
          tenantId,
          workRequestId: input.workRequestId,
          requestedByActorId: input.requestedByActorId,
          targetActorId: input.targetActorId,
          message: input.message,
          stateAtRequest: input.stateAtRequest,
          parentInfoRequestId: input.parentInfoRequestId,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
        },
      });
      if (input.documentVersionIds?.length)
        await db.workRequestV1InfoRequestAttachment.createMany({
          data: input.documentVersionIds.map((documentVersionId) => ({
            id: randomUUID(), tenantId, infoRequestId: requestId, documentVersionId,
          })),
        });
      const request = await db.workRequestV1InfoRequest.findFirstOrThrow({
        where: { id: requestId, tenantId }, select: workRequestInfoHistorySelect,
      });
      return { request, duplicate: false };
    });
  }

  async respond(
    workRequestId: string,
    infoRequestId: string,
    actorId: string,
    message: string,
    documentVersionIds?: string[],
    idempotencyKey?: string,
    correlationId?: string,
  ) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const existing = idempotencyKey
        ? await db.workRequestV1InfoResponse.findFirst({
            where: { tenantId, idempotencyKey },
            select: {
              id: true,
              respondedByActorId: true,
              message: true,
              respondedAt: true,
              attachments: { select: { documentVersionId: true } },
            },
          })
        : null;
      if (existing) return { kind: 'duplicate' as const, response: existing };
      const request = await db.workRequestV1InfoRequest.findFirst({
        where: { id: infoRequestId, workRequestId, tenantId },
        select: { targetActorId: true, status: true },
      });
      if (!request) return { kind: 'missing' as const };
      if (request.targetActorId !== actorId)
        return { kind: 'forbidden' as const };
      const at = new Date();
      const closed = await db.workRequestV1InfoRequest.updateMany({
        where: {
          id: infoRequestId,
          tenantId,
          status: InfoRequestStatusCode.OPEN,
        },
        data: { status: InfoRequestStatusCode.RESPONDED, closedAt: at },
      });
      if (closed.count !== 1) return { kind: 'closed' as const };
      const responseId = randomUUID();
      await db.workRequestV1InfoResponse.create({
          data: {
            id: responseId,
            tenantId,
            infoRequestId,
            respondedByActorId: actorId,
            message,
            respondedAt: at,
            idempotencyKey,
            correlationId,
          },
        });
      if (documentVersionIds?.length)
        await db.workRequestV1InfoResponseAttachment.createMany({
          data: documentVersionIds.map((documentVersionId) => ({
            id: randomUUID(), tenantId, infoResponseId: responseId, documentVersionId,
          })),
        });
      return {
        kind: 'ok' as const,
        response: await db.workRequestV1InfoResponse.findFirstOrThrow({
          where: { id: responseId, tenantId },
          select: {
            id: true,
            respondedByActorId: true,
            message: true,
            respondedAt: true,
            attachments: { select: { documentVersionId: true } },
          },
        }),
      };
    });
  }

  history(workRequestId: string, participantActorId?: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1InfoRequest.findMany({
        where: {
          tenantId,
          workRequestId,
          ...(participantActorId
            ? {
                OR: [
                  { requestedByActorId: participantActorId },
                  { targetActorId: participantActorId },
                ],
              }
            : {}),
        },
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
        select: workRequestInfoHistorySelect,
      }),
    );
  }

  async hasDocumentVersions(workRequestId: string, ids: string[]) {
    const tenantId = RequestContext.requireTenantId();
    const versions = await this.transaction((db) =>
      db.workRequestV1DocumentVersion.findMany({
        where: { tenantId, id: { in: ids }, document: { workRequestId } },
        select: { id: true },
      }),
    );
    return versions.length === ids.length;
  }
}

const recipientProfileSelect = {
  id: true,
  label: true,
  memberId: true,
  clientContactId: true,
  member: { select: {
    name: true,
    divisionLeadsByMemberId: {
      where: { revokedAt: null, division: { is: { isActive: true } } },
      select: { division: { select: { id: true, name: true } } },
    },
  } },
  clientContact: { select: { name: true, client: { select: { id: true, name: true } } } },
};

async function activeDivisionLeadMembers(
  db: any,
  tenantId: string,
  companyId: string,
  divisionIds?: string[],
) {
  const leads = await db.divisionLead.findMany({
    where: {
      tenantId,
      revokedAt: null,
      ...(divisionIds ? { divisionId: { in: divisionIds } } : {}),
      member: { is: { isActive: true, companyId } },
      division: { is: { isActive: true, companyId } },
    },
    select: { memberId: true },
  });
  return leads.map((lead: { memberId: string }) => lead.memberId);
}

async function activeTeamMemberIds(db: any, tenantId: string, teamIds: string[]) {
  if (!teamIds.length) return [];
  const members = await db.teamMember.findMany({
    where: {
      tenantId,
      teamId: { in: [...new Set(teamIds)] },
      leftAt: null,
      member: { is: { isActive: true } },
    },
    select: { memberId: true },
  });
  return members.map((member: { memberId: string }) => member.memberId);
}

function activeProfiles(
  db: any,
  tenantId: string,
  companyId: string,
  actorIds: string[],
  excludeActorId: string,
) {
  return db.actorProfile.findMany({
    where: {
      tenantId,
      id: { in: [...new Set(actorIds)], not: excludeActorId },
      isActive: true,
      user: { is: { isActive: true } },
      OR: [
        { member: { is: { isActive: true, companyId, company: { is: { isActive: true } } } } },
        { clientContact: { is: { isActive: true, client: { is: { isActive: true } } } } },
      ],
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function recipientProfiles(
  db: any,
  tenantId: string,
  companyId: string,
  memberIds: string[],
  excludeActorId: string,
) {
  return db.actorProfile.findMany({
    where: {
      tenantId,
      id: { not: excludeActorId },
      isActive: true,
      isDefault: true,
      user: { is: { isActive: true } },
      member: { is: { id: { in: [...new Set(memberIds)] }, companyId, isActive: true, company: { is: { isActive: true } } } },
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function clientRecipientProfiles(db: any, tenantId: string, clientId: string, excludeActorId: string) {
  return db.actorProfile.findMany({
    where: {
      tenantId,
      id: { not: excludeActorId },
      isActive: true,
      isDefault: true,
      user: { is: { isActive: true } },
      clientContact: { is: { clientId, isActive: true, client: { is: { isActive: true } } } },
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function dedupeProfiles(profiles: any[]) {
  return [...new Map(profiles.map((profile) => [profile.id, profile])).values()]
    .sort((left: any, right: any) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
}
