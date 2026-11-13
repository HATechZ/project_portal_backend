import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
  WorkRequestRouteStepKind,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import type { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import type { WorkRequestAssignmentSnapshot } from './work-request-assignment.records';
import {
  RESPONSIBILITY_HISTORY,
  type ResponsibilityHistoryPort,
} from '../../contracts/work-request-responsibility-history.port';
import {
  RESPONSIBILITY_PROFILE_RESOLVER,
  type ResponsibilityProfileResolverPort,
} from '../../contracts/responsibility-profile-resolver.port';
import {
  endDivisionResponsibilities,
  recordDivisionResponsibilities,
} from '../../infra/prisma/responsibility-history.writer';

@Injectable()
export class WorkRequestAssignmentRepository extends BaseRepository {
  constructor(
    uow: UnitOfWorkService,
    @Inject(RESPONSIBILITY_HISTORY)
    private readonly responsibilityHistory?: ResponsibilityHistoryPort,
    @Inject(RESPONSIBILITY_PROFILE_RESOLVER)
    private readonly responsibilityProfiles?: ResponsibilityProfileResolverPort,
  ) {
    super(uow);
  }

  async prepare(
    workRequestId: string,
    level: WorkRequestV1AssignmentLevelCode,
    targetId: string,
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
      return {
        parentCompanyId:
          request.bid?.client.companyId ??
          request.directProject?.client.companyId ??
          null,
        state: request.events[0]?.resultingState ?? null,
        active,
        target,
      };
    });
  }

  findByIdempotencyKey(idempotencyKey: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Event.findFirst({
        where: { tenantId, idempotencyKey },
        select: { id: true },
      }),
    );
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
    idempotencyKey?: string;
    correlationId?: string;
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
        if (closed.count !== 1)
          throw new AppException({
            code: AppErrorCode.Conflict,
            status: HttpStatus.CONFLICT,
            message:
              'The active Work Request assignment changed before reassignment could be completed. Refresh and try again.',
          });
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
      const event = await db.workRequestV1Event.create({
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
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          responsibilityLevel:
            input.level === WorkRequestV1AssignmentLevelCode.MEMBER ||
            input.level === WorkRequestV1AssignmentLevelCode.CHECKING ||
            input.level === WorkRequestV1AssignmentLevelCode.APPROVAL ||
            input.level === WorkRequestV1AssignmentLevelCode.FINAL_REVIEW
              ? input.level
              : undefined,
        },
        select: { id: true, action: true, occurredAt: true },
      });
      await this.synchronizeInitialRouteDivisionAssignment(db, input, at);
      return { ...assignment, currentState: input.resultingState, event };
    });
  }

  /**
   * Route-based requests reuse the initial Division-assignment command to
   * hand off from their immutable origin occurrence to the first configured
   * intermediate occurrence.  Keep that derived route position in the same
   * transaction as the compatibility assignment/event write.
   */
  async synchronizeExistingRouteDivisionAssignment(
    workRequestId: string,
    targetId: string,
    actorId: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const active = await db.workRequestV1Assignment.findFirst({
        where: {
          tenantId,
          workRequestId,
          level: WorkRequestV1AssignmentLevelCode.DIVISION,
          divisionId: targetId,
          unassignedAt: null,
          replacedAt: null,
        },
        select: { id: true },
      });
      if (!active) return false;
      return this.synchronizeInitialRouteDivisionAssignment(
        db,
        {
          workRequestId,
          level: WorkRequestV1AssignmentLevelCode.DIVISION,
          targetId,
          actorId,
          action: 'DIVISION_ASSIGNED',
          replacing: false,
        },
        new Date(),
      );
    });
  }

  private async synchronizeInitialRouteDivisionAssignment(
    db: PrismaExecutor,
    input: {
      workRequestId: string;
      level: WorkRequestV1AssignmentLevelCode;
      targetId: string;
      actorId: string;
      action: string;
      replacing: boolean;
    },
    at: Date,
  ): Promise<boolean> {
    if (
      input.level !== WorkRequestV1AssignmentLevelCode.DIVISION ||
      input.replacing ||
      input.action !== 'DIVISION_ASSIGNED'
    )
      return false;
    const tenantId = RequestContext.requireTenantId();
    const route = await db.workRequestRoute.findFirst({
      where: { tenantId, workRequestId: input.workRequestId },
      select: {
        id: true,
        projection: {
          select: { routeVersionId: true, routeStepId: true },
        },
      },
    });
    if (!route?.projection?.routeStepId || !route.projection.routeVersionId)
      return false;
    const routeVersionId = route.projection.routeVersionId;
    const current = await db.workRequestRouteStep.findFirst({
      where: {
        tenantId,
        id: route.projection.routeStepId,
        routeId: route.id,
      },
      select: { id: true, ordinal: true, kind: true, completedAt: true },
    });
    // A retry after the hand-off is already synchronized is intentionally a
    // no-op; it must not manufacture duplicate route history.
    if (current?.kind !== WorkRequestRouteStepKind.ORIGIN_START) return false;
    if (current.completedAt)
      throw conflict('The Work Request route origin has already completed.');
    const next = await db.workRequestRouteStep.findFirst({
      where: {
        tenantId,
        routeId: route.id,
        routeVersionId,
        ordinal: current.ordinal + 1,
        kind: WorkRequestRouteStepKind.INTERMEDIATE,
        divisionId: input.targetId,
      },
      select: { id: true },
    });
    if (!next)
      throw conflict(
        'The assigned Division is not the next configured Work Request route occurrence.',
      );
    const cycle = await db.workRequestDivisionCycle.findFirst({
      where: { tenantId, routeId: route.id, routeStepId: current.id },
      select: {
        id: true,
        completedAt: true,
        teamSteps: { take: 1, select: { id: true } },
      },
    });
    if (!cycle || cycle.completedAt || cycle.teamSteps.length)
      throw conflict(
        'The Work Request origin execution has already started and cannot be assigned as an initial Division hand-off.',
      );
    const nextCycleId = randomUUID();
    if (this.responsibilityHistory)
      await endDivisionResponsibilities(
        db,
        this.responsibilityHistory,
        tenantId,
        cycle.id,
        at,
      );
    await db.workRequestRouteStep.update({
      where: { id: current.id },
      data: { completedAt: at },
    });
    await db.workRequestDivisionCycle.update({
      where: { id: cycle.id },
      data: { completedAt: at },
    });
    await db.workRequestRouteStep.update({
      where: { id: next.id },
      data: { activatedAt: at },
    });
    await db.workRequestDivisionCycle.create({
      data: {
        id: nextCycleId,
        tenantId,
        routeId: route.id,
        routeStepId: next.id,
        activatedAt: at,
      },
    });
    if (this.responsibilityHistory && this.responsibilityProfiles)
      await recordDivisionResponsibilities({
        db,
        history: this.responsibilityHistory,
        profiles: this.responsibilityProfiles,
        tenantId,
        workRequestId: input.workRequestId,
        routeId: route.id,
        divisionCycleId: nextCycleId,
        divisionId: input.targetId,
        startedAt: at,
      });
    await db.workRequestRouteProjection.update({
      where: { routeId_tenantId: { routeId: route.id, tenantId } },
      data: {
        routeStepId: next.id,
        divisionCycleId: nextCycleId,
        teamStepId: null,
        memberStepId: null,
        updatedAt: at,
      },
    });
    await db.workRequestRouteEvent.create({
      data: {
        id: randomUUID(),
        tenantId,
        routeId: route.id,
        routeStepId: next.id,
        action: 'ROUTE_FORWARDED',
        performedByActorId: input.actorId,
      },
    });
    await db.workRequestRouteEvent.create({
      data: {
        id: randomUUID(),
        tenantId,
        routeId: route.id,
        routeStepId: next.id,
        divisionCycleId: nextCycleId,
        action: 'DIVISION_CYCLE_ACTIVATED',
        performedByActorId: input.actorId,
      },
    });
    return true;
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
      const responsibleRecipients = division
        ? await db.actorProfile.findMany({
            where: {
              tenantId,
              isActive: true,
              isDefault: true,
              user: { is: { isActive: true } },
              member: {
                is: {
                  isActive: true,
                  divisionLeadsByMemberId: {
                    some: { divisionId: division.id, revokedAt: null },
                  },
                },
              },
            },
            select: { id: true, memberId: true, label: true },
          })
        : [];
      return division
        ? {
            companyId: division.companyId,
            divisionId: division.id,
            teamId: null,
            permissionCodes: [],
            responsibleRecipients: responsibleRecipients.map((profile) => ({
              actorId: profile.id,
              memberId: profile.memberId!,
              label: profile.label,
            })),
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
            permissionCodes: [],
            responsibleRecipients: [],
          }
        : null;
    }
    const member = await db.member.findFirst({
      where: {
        id: targetId,
        tenantId,
        isActive: true,
      },
      select: {
        companyId: true,
        divisionId: true,
        user: {
          select: {
            isActive: true,
            userRolesByUserId: {
              where: { revokedAt: null },
              select: {
                role: {
                  select: {
                    isActive: true,
                    customScope: true,
                    rolePermissions: {
                      where: { revokedAt: null },
                      select: {
                        permission: {
                          select: {
                            code: true,
                            scopeCompatibilities: { select: { scope: true } },
                          },
                        },
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
    if (!member?.user?.isActive) return null;
    const permissionCodes = new Set<
      import('../../generated/prisma/client').PermissionCode
    >();
    for (const grant of member.user.userRolesByUserId) {
      const role = grant.role;
      if (!role.isActive) continue;
      for (const rolePermission of role.rolePermissions) {
        if (
          role.customScope === null ||
          rolePermission.permission.scopeCompatibilities.some(
            ({ scope }) => scope === role.customScope,
          )
        )
          permissionCodes.add(rolePermission.permission.code);
      }
    }
    return {
      companyId: member.companyId,
      divisionId: member.divisionId,
      teamId: active[WorkRequestV1AssignmentLevelCode.TEAM] ?? null,
      permissionCodes: [...permissionCodes],
      responsibleRecipients: [],
    };
  }
}

function conflict(message: string) {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
