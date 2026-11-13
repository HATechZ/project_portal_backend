import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  InfoRequestStatusCode,
  Prisma,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { workRequestVisibilityWhere } from '../../common/security/work-request-visibility';
import type { SessionActor } from '../../common/security/session.types';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
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
    return this.transaction(
      async (db) =>
        !!(await db.workRequestV1.findFirst({
          where: {
            id: workRequestId,
            tenantId,
            ...workRequestVisibilityWhere(actor),
          },
          select: { id: true },
        })),
    );
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
            where: {
              id: targetActorId,
              tenantId,
              isActive: true,
              user: { is: { isActive: true } },
            },
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
          bid: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          directProject: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          responsibilityHistory: {
            select: {
              actorProfileId: true,
              sourceMemberId: true,
              sourceUserId: true,
              sourceRoleId: true,
              responsibilityType: true,
              divisionCycleId: true,
              teamStepId: true,
              actorProfile: {
                select: { memberId: true, userId: true, roleId: true },
              },
            },
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
              projection: {
                select: {
                  divisionCycleId: true,
                  routeVersionId: true,
                  routeStepId: true,
                },
              },
              steps: {
                select: {
                  id: true,
                  divisionId: true,
                  routeVersionId: true,
                  activatedAt: true,
                },
              },
              divisionCycles: {
                select: {
                  id: true,
                  completedAt: true,
                  routeStep: { select: { divisionId: true } },
                  teamSteps: {
                    select: {
                      id: true,
                      teamId: true,
                      completedAt: true,
                      memberSteps: {
                        where: { cancelledAt: null },
                        select: { memberId: true },
                      },
                      team: {
                        select: {
                          divisionId: true,
                          leadMemberId: true,
                          isActive: true,
                        },
                      },
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
        where: {
          id: requesterActorId,
          tenantId,
          isActive: true,
          user: { is: { isActive: true } },
        },
        select: {
          id: true,
          memberId: true,
          clientContactId: true,
          role: { select: { customScope: true } },
        },
      });
      if (!requester) return [];

      const route = request.route;
      const cycles = route?.divisionCycles ?? [];
      const teams = cycles.flatMap((cycle) =>
        cycle.teamSteps
          .filter((step) => step.team.divisionId === cycle.routeStep.divisionId)
          .map((step) => ({
            ...step,
            divisionId: cycle.routeStep.divisionId,
            cycleCompletedAt: cycle.completedAt,
          })),
      );
      const activeCycle = cycles.find(
        (cycle) => cycle.id === route?.projection?.divisionCycleId,
      );
      const activeDivisionId = activeCycle?.routeStep.divisionId;
      const origin = !!(
        requester.memberId &&
        route?.responsibleOriginatingLead &&
        route.responsibleOriginatingLead.memberId === requester.memberId &&
        route.responsibleOriginatingLead.revokedAt === null &&
        route.responsibleOriginatingLead.member.isActive &&
        route.responsibleOriginatingLead.division.isActive
      );
      const isActiveDivisionLead = !!(
        requester.memberId &&
        activeDivisionId &&
        (await db.divisionLead.findFirst({
          where: {
            tenantId,
            memberId: requester.memberId,
            divisionId: activeDivisionId,
            revokedAt: null,
            member: { is: { isActive: true } },
            division: { is: { isActive: true } },
          },
          select: { id: true },
        }))
      );
      // Actor snapshots prevent a later profile rebind from inheriting history.
      const history = (request.responsibilityHistory ?? []).filter(
        (item) =>
          item.actorProfile.memberId === item.sourceMemberId &&
          item.actorProfile.userId === item.sourceUserId &&
          item.actorProfile.roleId === item.sourceRoleId,
      );
      const ownDivisionIds = new Set<string>();
      const scope = requester.role.customScope;
      if (
        origin &&
        (scope === 'division' || scope === 'company') &&
        route?.originatingDivisionId
      )
        ownDivisionIds.add(route.originatingDivisionId);
      if (scope === 'division' && isActiveDivisionLead && activeDivisionId)
        ownDivisionIds.add(activeDivisionId);
      for (const item of history) {
        if (
          scope !== 'division' ||
          item.actorProfileId !== requesterActorId ||
          item.responsibilityType !== 'DIVISION'
        )
          continue;
        const cycle = cycles.find((entry) => entry.id === item.divisionCycleId);
        if (cycle?.routeStep.divisionId)
          ownDivisionIds.add(cycle.routeStep.divisionId);
      }
      const ownLeadTeamIds = new Set<string>();
      for (const step of teams) {
        if (
          requester.memberId &&
          !step.completedAt &&
          !step.cycleCompletedAt &&
          step.team.isActive &&
          step.team.leadMemberId === requester.memberId
        )
          ownLeadTeamIds.add(step.teamId);
        if (
          history.some(
            (item) =>
              item.actorProfileId === requesterActorId &&
              item.responsibilityType === 'TEAM' &&
              item.teamStepId === step.id,
          )
        )
          ownLeadTeamIds.add(step.teamId);
      }
      const assignedMemberTeamIds = requester.memberId
        ? (
            await db.workRequestMemberStep.findMany({
              where: {
                tenantId,
                route: { is: { workRequestId } },
                memberId: requester.memberId,
                cancelledAt: null,
              },
              select: { teamStep: { select: { teamId: true } } },
            })
          ).map((step) => step.teamStep.teamId)
        : [];
      const memberTeamIds = assignedMemberTeamIds;
      const memberIds = new Set<string>();
      const historicalActorIds = new Set<string>();
      const includeClientContacts =
        origin && (scope === 'division' || scope === 'company');
      const addTeamLeads = (
        divisionIds: Set<string>,
        teamIds?: Set<string>,
      ) => {
        for (const step of teams) {
          if (
            !step.divisionId ||
            !divisionIds.has(step.divisionId) ||
            (teamIds && !teamIds.has(step.teamId))
          )
            continue;
          if (step.team.isActive && step.team.leadMemberId)
            memberIds.add(step.team.leadMemberId);
          for (const item of history)
            if (
              item.responsibilityType === 'TEAM' &&
              item.sourceMemberId !== requester.memberId &&
              item.teamStepId === step.id
            )
              historicalActorIds.add(item.actorProfileId);
        }
      };
      const addDivisionHistory = (divisionIds: Set<string>) => {
        for (const item of history) {
          if (
            item.responsibilityType !== 'DIVISION' ||
            item.sourceMemberId === requester.memberId
          )
            continue;
          const cycle = cycles.find(
            (entry) => entry.id === item.divisionCycleId,
          );
          if (
            cycle?.routeStep.divisionId &&
            divisionIds.has(cycle.routeStep.divisionId)
          )
            historicalActorIds.add(item.actorProfileId);
        }
      };
      const addParticipatingMembers = (teamIds: Set<string>) => {
        for (const step of teams)
          if (teamIds.has(step.teamId))
            for (const member of step.memberSteps ?? [])
              memberIds.add(member.memberId);
      };
      if (ownDivisionIds.size) {
        const divisionIds = new Set<string>();
        if (route?.originatingDivisionId)
          divisionIds.add(route.originatingDivisionId);
        for (const cycle of cycles)
          if (cycle.routeStep.divisionId)
            divisionIds.add(cycle.routeStep.divisionId);
        for (const step of route?.steps ?? []) {
          if (!step.divisionId) continue;
          if (
            step.activatedAt ||
            step.routeVersionId === route?.projection?.routeVersionId ||
            step.id === route?.projection?.routeStepId
          ) {
            divisionIds.add(step.divisionId);
          }
        }
        if (
          route?.responsibleOriginatingLead.revokedAt === null &&
          route.responsibleOriginatingLead.member.isActive &&
          route.responsibleOriginatingLead.division.isActive
        )
          memberIds.add(route.responsibleOriginatingLead.memberId);
        (
          await activeDivisionLeadMembers(
            db,
            tenantId,
            parent.client.companyId,
            [...divisionIds],
          )
        ).forEach((id) => memberIds.add(id));
        addDivisionHistory(divisionIds);
        addTeamLeads(ownDivisionIds);
      } else if (scope === 'team' && ownLeadTeamIds.size) {
        const divisionIds = new Set(
          teams
            .filter(
              (step) => ownLeadTeamIds.has(step.teamId) && step.divisionId,
            )
            .map((step) => step.divisionId)
            .filter((id): id is string => !!id),
        );
        addDivisionHistory(divisionIds);
        if (
          route?.originatingDivisionId &&
          divisionIds.has(route.originatingDivisionId) &&
          route.responsibleOriginatingLead.revokedAt === null &&
          route.responsibleOriginatingLead.member.isActive &&
          route.responsibleOriginatingLead.division.isActive
        )
          memberIds.add(route.responsibleOriginatingLead.memberId);
        (
          await activeDivisionLeadMembers(
            db,
            tenantId,
            parent.client.companyId,
            [...divisionIds],
          )
        ).forEach((id) => memberIds.add(id));
        addTeamLeads(divisionIds);
        addParticipatingMembers(ownLeadTeamIds);
        (await activeTeamMemberIds(db, tenantId, [...ownLeadTeamIds])).forEach(
          (id) => memberIds.add(id),
        );
      } else if (scope === 'member' && memberTeamIds.length) {
        const teamIds = new Set(memberTeamIds);
        const divisionIds = new Set(
          teams
            .filter((step) => teamIds.has(step.teamId) && step.divisionId)
            .map((step) => step.divisionId)
            .filter((id): id is string => !!id),
        );
        addTeamLeads(divisionIds, teamIds);
        addParticipatingMembers(teamIds);
        (await activeTeamMemberIds(db, tenantId, memberTeamIds)).forEach((id) =>
          memberIds.add(id),
        );
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
      const reciprocalActorIds = reciprocal.map((item) =>
        item.requestedByActorId === requesterActorId
          ? item.targetActorId
          : item.requestedByActorId,
      );

      if (requester.memberId) memberIds.delete(requester.memberId);
      historicalActorIds.delete(requesterActorId);

      const internal = memberIds.size
        ? await recipientProfiles(
            db,
            tenantId,
            parent.client.companyId,
            [...memberIds],
            requesterActorId,
          )
        : [];
      const contacts = includeClientContacts
        ? await clientRecipientProfiles(
            db,
            tenantId,
            parent.clientId,
            requesterActorId,
          )
        : [];
      const recipientActorIds = [...historicalActorIds, ...reciprocalActorIds];
      const reciprocalProfiles = recipientActorIds.length
        ? await activeProfiles(
            db,
            tenantId,
            parent.client.companyId,
            recipientActorIds,
            requesterActorId,
          )
        : [];
      return dedupeProfiles([...internal, ...contacts, ...reciprocalProfiles]);
    });
  }

  hasInfoRelationship(workRequestId: string, actorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1InfoRequest.findFirst({
        where: {
          tenantId,
          workRequestId,
          OR: [{ requestedByActorId: actorId }, { targetActorId: actorId }],
        },
        select: { id: true },
      }),
    );
  }

  async isActiveRouteLead(workRequestId: string, memberId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route = await this.routeDivisions(db, workRequestId);
      if (!route) return false;
      return !!(await db.divisionLead.findFirst({
        where: {
          tenantId,
          memberId,
          divisionId: { in: route.divisionIds },
          revokedAt: null,
          division: { is: { isActive: true } },
          member: { is: { isActive: true } },
        },
        select: { id: true },
      }));
    });
  }

  private async routeDivisions(db: PrismaExecutor, workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    const route = await db.workRequestRoute.findFirst({
      where: { tenantId, workRequestId },
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
        projection: { select: { routeVersionId: true, routeStepId: true } },
        steps: {
          select: {
            id: true,
            routeVersionId: true,
            divisionId: true,
            activatedAt: true,
          },
        },
      },
    });
    if (!route) return null;
    const lead = route.responsibleOriginatingLead;
    const divisionIds = new Set([route.originatingDivisionId]);
    for (const step of route.steps) {
      if (
        step.divisionId &&
        (step.activatedAt ||
          step.id === route.projection?.routeStepId ||
          (route.projection?.routeVersionId &&
            step.routeVersionId === route.projection.routeVersionId))
      )
        divisionIds.add(step.divisionId);
    }
    return {
      divisionIds: [...divisionIds],
      responsibleMemberId: lead.memberId,
      responsibleActive:
        lead.revokedAt === null &&
        lead.member.isActive &&
        lead.division.isActive,
    };
  }

  clientRecipientStatus(workRequestId: string, requesterActorId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          bid: { select: { clientId: true } },
          directProject: { select: { clientId: true } },
        },
      });
      const clientId =
        request?.bid?.clientId ?? request?.directProject?.clientId;
      if (!clientId) return null;
      const route = await db.workRequestRoute.findFirst({
        where: { tenantId, workRequestId },
        select: {
          responsibleOriginatingLead: {
            select: { memberId: true, revokedAt: true },
          },
        },
      });
      const requester = await db.actorProfile.findFirst({
        where: { tenantId, id: requesterActorId, isActive: true },
        select: { memberId: true },
      });
      if (
        !route?.responsibleOriginatingLead ||
        route.responsibleOriginatingLead.revokedAt !== null ||
        route.responsibleOriginatingLead.memberId !== requester?.memberId
      )
        return {
          activeContacts: 0,
          contactsWithActiveDefaultProfile: 0,
          unavailableContacts: [],
        };
      const contacts = await db.clientContact.findMany({
        where: {
          tenantId,
          clientId,
          isActive: true,
          client: { is: { isActive: true } },
        },
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
          actorProfilesByClientContactId: {
            where: {
              isActive: true,
              isDefault: true,
              user: { is: { isActive: true } },
            },
            select: { id: true },
          },
        },
      });
      return {
        activeContacts: contacts.length,
        contactsWithActiveDefaultProfile: contacts.filter(
          (contact) => contact.actorProfilesByClientContactId.length > 0,
        ).length,
        unavailableContacts: contacts
          .filter((contact) => !contact.actorProfilesByClientContactId.length)
          .map((contact) => ({
            contactId: contact.id,
            displayName: contact.name,
            recipientType: 'EXTERNAL_CLIENT_CONTACT',
            contextType: 'CLIENT_CONTACT',
            context: contact.client,
            canReceive: false,
            canRespond: false,
            unavailableReason:
              'Client contact unavailable — portal access/profile not configured',
          })),
      };
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
            id: randomUUID(),
            tenantId,
            infoRequestId: requestId,
            documentVersionId,
          })),
        });
      const request = await db.workRequestV1InfoRequest.findFirstOrThrow({
        where: { id: requestId, tenantId },
        select: workRequestInfoHistorySelect,
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
            id: randomUUID(),
            tenantId,
            infoResponseId: responseId,
            documentVersionId,
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
  member: {
    select: {
      name: true,
      email: true,
      division: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      teamMembersByMemberId: {
        where: { leftAt: null, team: { is: { isActive: true } } },
        select: { team: { select: { id: true, name: true } } },
      },
      teamsByLeadMemberId: {
        where: { isActive: true },
        select: { id: true, name: true },
      },
      divisionLeadsByMemberId: {
        where: { revokedAt: null, division: { is: { isActive: true } } },
        select: { division: { select: { id: true, name: true } } },
      },
    },
  },
  clientContact: {
    select: {
      name: true,
      email: true,
      client: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ActorProfileSelect;

type RecipientProfile = Prisma.ActorProfileGetPayload<{
  select: typeof recipientProfileSelect;
}>;

async function activeDivisionLeadMembers(
  db: PrismaExecutor,
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

async function activeTeamMemberIds(
  db: PrismaExecutor,
  tenantId: string,
  teamIds: string[],
) {
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
  db: PrismaExecutor,
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
        {
          member: {
            is: {
              isActive: true,
              companyId,
              company: { is: { isActive: true } },
            },
          },
        },
        {
          clientContact: {
            is: { isActive: true, client: { is: { isActive: true } } },
          },
        },
      ],
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function recipientProfiles(
  db: PrismaExecutor,
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
      member: {
        is: {
          id: { in: [...new Set(memberIds)] },
          companyId,
          isActive: true,
          company: { is: { isActive: true } },
        },
      },
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function clientRecipientProfiles(
  db: PrismaExecutor,
  tenantId: string,
  clientId: string,
  excludeActorId: string,
) {
  return db.actorProfile.findMany({
    where: {
      tenantId,
      id: { not: excludeActorId },
      isActive: true,
      isDefault: true,
      user: { is: { isActive: true } },
      clientContact: {
        is: { clientId, isActive: true, client: { is: { isActive: true } } },
      },
    },
    select: recipientProfileSelect,
    orderBy: [{ label: 'asc' }, { id: 'asc' }],
  });
}

function dedupeProfiles(profiles: RecipientProfile[]) {
  return [
    ...new Map(profiles.map((profile) => [profile.id, profile])).values(),
  ].sort(
    (left, right) =>
      left.label.localeCompare(right.label) || left.id.localeCompare(right.id),
  );
}
