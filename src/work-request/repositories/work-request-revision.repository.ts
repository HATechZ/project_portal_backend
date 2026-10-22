import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { CustomRoleScope, WorkRequestRouteRevisionClassification as Classification } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

type RevisionRequest = {
  classification: Classification;
  sourceActorId: string;
  sourceMemberStepId?: string;
  sourceTeamStepId?: string;
  sourceDivisionCycleId?: string;
  reason: string;
  idempotencyKey?: string;
  correlationId?: string;
};

@Injectable()
export class WorkRequestRevisionRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  request(workRequestId: string, actorId: string, memberId: string, input: RevisionRequest) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const route = await db.workRequestRoute.findFirst({
        where: { tenantId, workRequestId },
        include: { projection: true },
      });
      if (!route?.projection) throw conflict('The route has no active projection.');
      const existing = input.idempotencyKey
        ? await db.workRequestRouteRevision.findFirst({ where: { tenantId, routeId: route.id, idempotencyKey: input.idempotencyKey } })
        : null;
      if (existing) return { revision: existing, event: null };
      if (route.projection.openRevisionId) throw conflict('The route is already paused by a revision.');
      const requester = await requesterContext(db, tenantId, route.id, route.projection, actorId, memberId, input.classification);
      const source = await sourceContext(db, tenantId, route.id, input, requester);
      const aggregate = await db.workRequestRouteRevision.aggregate({ where: { tenantId, routeId: route.id }, _max: { roundNumber: true } });
      const revisionId = randomUUID();
      const now = new Date();
      await db.workRequestRouteRevision.create({
        data: {
          id: revisionId, tenantId, routeId: route.id, classification: input.classification,
          roundNumber: (aggregate._max.roundNumber ?? 0) + 1,
          requesterActorId: actorId, requesterRouteStepId: requester.routeStepId,
          requesterDivisionCycleId: requester.divisionCycleId, requesterTeamStepId: requester.teamStepId, requesterMemberStepId: requester.memberStepId,
          sourceActorId: source.actorId, sourceRouteStepId: source.routeStepId,
          sourceDivisionCycleId: source.divisionCycleId, sourceTeamStepId: source.teamStepId, sourceMemberStepId: source.memberStepId,
          resumeRouteStepId: requester.routeStepId, resumeDivisionCycleId: requester.divisionCycleId,
          resumeTeamStepId: requester.teamStepId, resumeMemberStepId: requester.memberStepId,
          reason: input.reason, requestedAt: now, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId,
        },
      });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: route.id, tenantId } }, data: { openRevisionId: revisionId, updatedAt: now } });
      const action = input.classification === Classification.CROSS_DIVISION_FORMAL ? 'FORMAL_REVISION_TRIGGERED' : 'REVISION_REQUESTED';
      const eventId = randomUUID();
      await db.workRequestRouteEvent.create({ data: { id: eventId, tenantId, routeId: route.id, routeStepId: requester.routeStepId, divisionCycleId: requester.divisionCycleId, teamStepId: requester.teamStepId, memberStepId: requester.memberStepId, revisionId, action, performedByActorId: actorId, idempotencyKey: input.idempotencyKey } });
      return { revision: await db.workRequestRouteRevision.findFirstOrThrow({ where: { id: revisionId, tenantId } }), event: { id: eventId, action, occurredAt: now } };
    }, { isolationLevel: 'Serializable' });
  }

  resubmit(workRequestId: string, revisionId: string, actorId: string, memberId: string, scope: CustomRoleScope | null) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const revision = await db.workRequestRouteRevision.findFirst({
        where: { id: revisionId, tenantId, route: { is: { workRequestId } } },
        include: { sourceActor: { select: { memberId: true } }, route: { include: { projection: true } } },
      });
      if (!revision || revision.sourceActorId !== actorId || revision.sourceActor.memberId !== memberId || !scopeAllows(scope, revision.classification)) throw forbidden();
      if (revision.submittedAt || revision.resumedAt || revision.route.projection?.openRevisionId !== revision.id) throw conflict('The revision is not open for this source.');
      const now = new Date();
      const updated = await db.workRequestRouteRevision.updateMany({ where: { id: revision.id, tenantId, submittedAt: null, resumedAt: null }, data: { submittedAt: now, resumedAt: now } });
      if (updated.count !== 1) throw conflict('The revision has already been resumed.');
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: revision.routeId, tenantId } }, data: { routeStepId: revision.resumeRouteStepId, divisionCycleId: revision.resumeDivisionCycleId, teamStepId: revision.resumeTeamStepId, memberStepId: revision.resumeMemberStepId, openRevisionId: null, updatedAt: now } });
      const eventId = randomUUID();
      const action = 'REVISION_RESUBMITTED_AND_RESUMED';
      await db.workRequestRouteEvent.create({ data: { id: eventId, tenantId, routeId: revision.routeId, routeStepId: revision.resumeRouteStepId, divisionCycleId: revision.resumeDivisionCycleId, teamStepId: revision.resumeTeamStepId, memberStepId: revision.resumeMemberStepId, revisionId: revision.id, action, performedByActorId: actorId } });
      return { revision: await db.workRequestRouteRevision.findFirstOrThrow({ where: { id: revision.id, tenantId } }), event: { id: eventId, action, occurredAt: now } };
    }, { isolationLevel: 'Serializable' });
  }
}

async function requesterContext(db: any, tenantId: string, routeId: string, projection: any, actorId: string, memberId: string, classification: Classification) {
  if (!projection.routeStepId) throw conflict('The route has no active execution context.');
  const base = { routeStepId: projection.routeStepId, divisionCycleId: projection.divisionCycleId, teamStepId: projection.teamStepId, memberStepId: projection.memberStepId, requesterMemberId: memberId };
  if (classification === Classification.INTERNAL_MEMBER) {
    const step = projection.memberStepId && await db.workRequestMemberStep.findFirst({ where: { id: projection.memberStepId, tenantId, routeId, memberId, submittedAt: null, activatedAt: { not: null } } });
    if (!step) throw forbidden();
    return base;
  }
  if (classification === Classification.INTERNAL_TEAM) {
    const step = projection.teamStepId && await db.workRequestTeamStep.findFirst({ where: { id: projection.teamStepId, tenantId, routeId, activatedAt: { not: null }, completedAt: null }, include: { team: { select: { leadMemberId: true } } } });
    if (!step || step.team.leadMemberId !== memberId) throw forbidden();
    return base;
  }
  const cycle = projection.divisionCycleId && await db.workRequestDivisionCycle.findFirst({ where: { id: projection.divisionCycleId, tenantId, routeId, completedAt: null }, include: { routeStep: { select: { divisionId: true } } } });
  if (!cycle || !cycle.routeStep.divisionId || !(await db.divisionLead.findFirst({ where: { tenantId, divisionId: cycle.routeStep.divisionId, memberId, revokedAt: null } }))) throw forbidden();
  return base;
}

async function sourceContext(db: any, tenantId: string, routeId: string, input: RevisionRequest, requester: any) {
  const ids = [input.sourceMemberStepId, input.sourceTeamStepId, input.sourceDivisionCycleId].filter(Boolean);
  if (ids.length !== 1) throw bad('Supply exactly one source execution context.');
  if (input.classification === Classification.INTERNAL_MEMBER) {
    if (!input.sourceMemberStepId) throw bad('An internal Member revision requires a Member source step.');
    const step = await db.workRequestMemberStep.findFirst({ where: { id: input.sourceMemberStepId, tenantId, routeId, activatedAt: { not: null } }, include: { teamStep: true } });
    if (!step || step.teamStepId !== requester.teamStepId || step.memberId === requester.requesterMemberId) throw conflict('The source Member must be a different participant in the same Team context.');
    return actorForMember(db, tenantId, input.sourceActorId, step.memberId, { routeStepId: requester.routeStepId, divisionCycleId: requester.divisionCycleId, teamStepId: step.teamStepId, memberStepId: step.id });
  }
  if (input.classification === Classification.INTERNAL_TEAM) {
    if (!input.sourceTeamStepId) throw bad('An internal Team revision requires a Team source step.');
    const step = await db.workRequestTeamStep.findFirst({ where: { id: input.sourceTeamStepId, tenantId, routeId, activatedAt: { not: null } }, include: { team: { select: { leadMemberId: true } } } });
    if (!step || step.divisionCycleId !== requester.divisionCycleId || !step.team.leadMemberId || step.id === requester.teamStepId) throw conflict('The source Team must be a different Team in the same Division cycle.');
    return actorForMember(db, tenantId, input.sourceActorId, step.team.leadMemberId, { routeStepId: requester.routeStepId, divisionCycleId: step.divisionCycleId, teamStepId: step.id, memberStepId: null });
  }
  if (!input.sourceDivisionCycleId) throw bad('A cross-Division revision requires a Division source cycle.');
  const cycle = await db.workRequestDivisionCycle.findFirst({ where: { id: input.sourceDivisionCycleId, tenantId, routeId }, include: { routeStep: { select: { divisionId: true } } } });
  if (!cycle || !cycle.routeStep.divisionId || cycle.id === requester.divisionCycleId) throw conflict('The source must be a different relevant Division occurrence.');
  const sourceActor = await db.actorProfile.findFirst({ where: { id: input.sourceActorId, tenantId, isActive: true }, select: { memberId: true } });
  const lead = sourceActor?.memberId && await db.divisionLead.findFirst({ where: { tenantId, divisionId: cycle.routeStep.divisionId, memberId: sourceActor.memberId, revokedAt: null }, select: { memberId: true } });
  if (!lead) throw conflict('The source Division has no active Lead.');
  return actorForMember(db, tenantId, input.sourceActorId, lead.memberId, { routeStepId: cycle.routeStepId, divisionCycleId: cycle.id, teamStepId: null, memberStepId: null });
}

async function actorForMember(db: any, tenantId: string, actorId: string, memberId: string, context: any) {
  const actor = await db.actorProfile.findFirst({ where: { id: actorId, tenantId, memberId, isActive: true }, select: { id: true } });
  if (!actor) throw conflict('The source responsibility has no active actor.');
  return { actorId: actor.id, ...context };
}
function bad(message: string) { return new AppException({ code: AppErrorCode.BadRequest, status: HttpStatus.BAD_REQUEST, message }); }
function conflict(message: string) { return new AppException({ code: AppErrorCode.Conflict, status: HttpStatus.CONFLICT, message }); }
function forbidden() { return new AppException({ code: AppErrorCode.Forbidden, status: HttpStatus.FORBIDDEN, message: "You don't have permission to perform this action." }); }
function scopeAllows(scope: CustomRoleScope | null, classification: Classification) {
  if (scope === null) return false;
  if (classification === Classification.CROSS_DIVISION_FORMAL)
    return scope === CustomRoleScope.company || scope === CustomRoleScope.division;
  if (classification === Classification.INTERNAL_TEAM)
    return scope === CustomRoleScope.company || scope === CustomRoleScope.division || scope === CustomRoleScope.team;
  return scope === CustomRoleScope.company || scope === CustomRoleScope.division || scope === CustomRoleScope.team || scope === CustomRoleScope.member;
}
