import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import type { WorkRequestAssignmentSnapshot } from './work-request-assignment.records';

@Injectable()
export class WorkRequestAssignmentRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  async prepare(
    workRequestId: string,
    level: WorkRequestV1AssignmentLevelCode,
    targetId: string,
    boundTeamId: string | null,
  ): Promise<WorkRequestAssignmentSnapshot | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const request = await db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          bid: { select: { client: { select: { companyId: true } } } },
          directProject: {
            select: { client: { select: { companyId: true } } },
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
      const active = Object.fromEntries(
        request.assignments.map((assignment) => [
          assignment.level,
          assignment.divisionId ?? assignment.teamId ?? assignment.memberId!,
        ]),
      ) as WorkRequestAssignmentSnapshot['active'];
      const target = await this.target(db, level, targetId, active);
      const boundTeam = boundTeamId
        ? await db.team.findFirst({
            where: { id: boundTeamId, tenantId, isActive: true },
            select: { id: true, companyId: true, divisionId: true },
          })
        : null;
      return {
        parentCompanyId:
          request.bid?.client.companyId ??
          request.directProject?.client.companyId ??
          null,
        state: request.events[0]?.resultingState ?? null,
        active,
        target,
        boundTeam,
      };
    });
  }

  write(input: {
    workRequestId: string;
    level: WorkRequestV1AssignmentLevelCode;
    targetId: string;
    actorId: string;
    note?: string;
    priorState: WorkRequestV1StateCode;
    resultingState: WorkRequestV1StateCode;
    action: string;
    replacing: boolean;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const at = new Date();
      if (input.replacing) {
        const closed = await db.workRequestV1Assignment.updateMany({
          where: {
            tenantId,
            workRequestId: input.workRequestId,
            level: input.level,
            unassignedAt: null,
            replacedAt: null,
          },
          data: { replacedAt: at },
        });
        if (closed.count !== 1) throw new Error('WR_ACTIVE_ASSIGNMENT');
      }
      const assignment = await db.workRequestV1Assignment.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          level: input.level,
          assignedByActorId: input.actorId,
          assignedAt: at,
          note: input.note,
          ...(input.level === WorkRequestV1AssignmentLevelCode.DIVISION
            ? { divisionId: input.targetId }
            : input.level === WorkRequestV1AssignmentLevelCode.TEAM
              ? { teamId: input.targetId }
              : { memberId: input.targetId }),
        },
        select: {
          id: true,
          level: true,
          divisionId: true,
          teamId: true,
          memberId: true,
          assignedAt: true,
        },
      });
      await db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          action: input.action,
          priorState: input.priorState,
          resultingState: input.resultingState,
          performedByActorId: input.actorId,
          occurredAt: at,
          note: input.note,
        },
      });
      return { ...assignment, currentState: input.resultingState };
    });
  }

  private async target(
    db: PrismaExecutor,
    level: WorkRequestV1AssignmentLevelCode,
    targetId: string,
    active: WorkRequestAssignmentSnapshot['active'],
  ): Promise<WorkRequestAssignmentSnapshot['target']> {
    const tenantId = RequestContext.requireTenantId();
    if (level === WorkRequestV1AssignmentLevelCode.DIVISION) {
      const division = await db.division.findFirst({
        where: { id: targetId, tenantId, isActive: true },
        select: { companyId: true, id: true },
      });
      return division
        ? {
            companyId: division.companyId,
            divisionId: division.id,
            teamId: null,
          }
        : null;
    }
    if (level === WorkRequestV1AssignmentLevelCode.TEAM) {
      const team = await db.team.findFirst({
        where: { id: targetId, tenantId, isActive: true },
        select: { id: true, companyId: true, divisionId: true },
      });
      return team
        ? {
            companyId: team.companyId,
            divisionId: team.divisionId,
            teamId: team.id,
          }
        : null;
    }
    const teamId = active[WorkRequestV1AssignmentLevelCode.TEAM];
    if (!teamId) return null;
    const member = await db.member.findFirst({
      where: {
        id: targetId,
        tenantId,
        isActive: true,
        teamMembersByMemberId: { some: { tenantId, teamId, leftAt: null } },
      },
      select: { companyId: true, divisionId: true },
    });
    return member
      ? { companyId: member.companyId, divisionId: member.divisionId, teamId }
      : null;
  }
}
