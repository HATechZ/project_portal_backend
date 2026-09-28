import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export type WorkRequestWorkflowSnapshot = {
  state: WorkRequestV1StateCode | null;
  parent: { clientId: string; companyId: string | null } | null;
  active: Partial<Record<WorkRequestV1AssignmentLevelCode, string>>;
  teamLeadMemberId: string | null;
};

@Injectable()
export class WorkRequestWorkflowRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  async prepare(id: string): Promise<WorkRequestWorkflowSnapshot | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id, tenantId },
        select: {
          bid: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          directProject: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          events: {
            take: 1,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: { resultingState: true },
          },
          assignments: {
            where: { unassignedAt: null, replacedAt: null },
            select: {
              level: true,
              divisionId: true,
              teamId: true,
              memberId: true,
            },
          },
        },
      });
      if (!request) return null;
      const parent = request.bid ?? request.directProject;
      const active = Object.fromEntries(
        request.assignments.map((assignment) => [
          assignment.level,
          assignment.divisionId ?? assignment.teamId ?? assignment.memberId!,
        ]),
      ) as WorkRequestWorkflowSnapshot['active'];
      const teamId = active[WorkRequestV1AssignmentLevelCode.TEAM];
      const team = teamId
        ? await db.team.findFirst({
            where: { id: teamId, tenantId, isActive: true },
            select: { leadMemberId: true },
          })
        : null;
      return {
        state: request.events[0]?.resultingState ?? null,
        parent: parent
          ? { clientId: parent.clientId, companyId: parent.client.companyId }
          : null,
        active,
        teamLeadMemberId: team?.leadMemberId ?? null,
      };
    });
  }

  actionCode(actionId: string) {
    return this.transaction((db) =>
      db.workflowActionDefinition.findUnique({
        where: { id: actionId },
        select: { code: true },
      }),
    );
  }

  append(input: {
    workRequestId: string;
    actorId: string;
    action: string;
    priorState: WorkRequestV1StateCode;
    resultingState: WorkRequestV1StateCode;
    note?: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const occurredAt = new Date();
      const event = await db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          action: input.action,
          priorState: input.priorState,
          resultingState: input.resultingState,
          performedByActorId: input.actorId,
          occurredAt,
          note: input.note,
        },
        select: {
          id: true,
          action: true,
          resultingState: true,
          occurredAt: true,
        },
      });
      return {
        eventId: event.id,
        action: event.action,
        currentState: event.resultingState,
        occurredAt: event.occurredAt,
      };
    });
  }
}
