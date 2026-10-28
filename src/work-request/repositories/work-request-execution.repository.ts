import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class WorkRequestExecutionRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  internalCycle(workRequestId: string, cycleId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const cycle = await db.workRequestDivisionCycle.findFirst({
        where: { id: cycleId, tenantId, route: { is: { workRequestId } } },
        include: {
          routeStep: { select: { divisionId: true } },
          teamSteps: {
            orderBy: { ordinal: 'asc' },
            include: { team: { select: { id: true, name: true, leadMemberId: true } }, memberSteps: { orderBy: { ordinal: 'asc' }, include: { member: { select: { id: true, name: true } } } } },
          },
        },
      });
      if (!cycle) throw notFound();
      const isDivisionLead =
        isAdmin ||
        (!!cycle.routeStep.divisionId &&
          !!memberId &&
          !!(await db.divisionLead.findFirst({
            where: {
              tenantId,
              divisionId: cycle.routeStep.divisionId,
              memberId,
              revokedAt: null,
            },
            select: { id: true },
          })));
      const related = isAdmin || isDivisionLead || cycle.teamSteps.some((teamStep) =>
        teamStep.team.leadMemberId === memberId || teamStep.memberSteps.some((memberStep) => memberStep.memberId === memberId),
      );
      if (!related) throw forbidden();
      return {
        ...cycle,
        availableActions: executionActions(cycle, memberId, isDivisionLead, isAdmin),
      };
    });
  }

  defineTeamSequence(workRequestId: string, cycleId: string, teamIds: string[], actorId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const cycle = await activeCycle(db, tenantId, workRequestId, cycleId);
      if (!isAdmin) await requireDivisionLead(db, tenantId, cycle.routeStep.divisionId, memberId!);
      if (await db.workRequestTeamStep.count({ where: { tenantId, divisionCycleId: cycle.id } })) throw conflict('The Team sequence is frozen.');
      const distinctIds = [...new Set(teamIds)];
      const teams = await db.team.findMany({ where: { tenantId, id: { in: distinctIds }, divisionId: cycle.routeStep.divisionId!, isActive: true }, select: { id: true } });
      if (teams.length !== distinctIds.length) throw bad('Every Team must be active and belong to the active Division.');
      const ids = teamIds.map(() => randomUUID());
      const now = new Date();
      await db.workRequestTeamStep.createMany({ data: teamIds.map((teamId, index) => ({ id: ids[index], tenantId, routeId: cycle.routeId, divisionCycleId: cycle.id, ordinal: index + 1, teamId, activatedAt: index === 0 ? now : null })) });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: cycle.routeId, tenantId } }, data: { divisionCycleId: cycle.id, teamStepId: ids[0], memberStepId: null, updatedAt: now } });
      await event(db, tenantId, cycle.routeId, actorId, 'TEAM_SEQUENCE_DEFINED', { divisionCycleId: cycle.id, teamStepId: ids[0] });
      return this.internalCycle(workRequestId, cycle.id, memberId, isAdmin);
    }, { isolationLevel: 'Serializable' });
  }

  defineMemberSequence(workRequestId: string, teamStepId: string, memberIds: string[], actorId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const teamStep = await activeTeamStep(db, tenantId, workRequestId, teamStepId);
      if (!isAdmin && teamStep.team.leadMemberId !== memberId) throw forbidden();
      if (await db.workRequestMemberStep.count({ where: { tenantId, teamStepId } })) throw conflict('The Member sequence has already been defined.');
      await requireTeamMembers(db, tenantId, teamStep.teamId, memberIds);
      const ids = memberIds.map(() => randomUUID());
      const now = new Date();
      await db.workRequestMemberStep.createMany({ data: memberIds.map((targetMemberId, index) => ({ id: ids[index], tenantId, routeId: teamStep.routeId, teamStepId, ordinal: index + 1, memberId: targetMemberId, activatedAt: index === 0 ? now : null })) });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: teamStep.routeId, tenantId } }, data: { divisionCycleId: teamStep.divisionCycleId, teamStepId, memberStepId: ids[0], updatedAt: now } });
      await event(db, tenantId, teamStep.routeId, actorId, 'MEMBER_SEQUENCE_DEFINED', { divisionCycleId: teamStep.divisionCycleId, teamStepId, memberStepId: ids[0] });
      return this.internalCycle(workRequestId, teamStep.divisionCycleId, memberId, isAdmin);
    }, { isolationLevel: 'Serializable' });
  }

  appendMemberStep(workRequestId: string, teamStepId: string, targetMemberId: string, actorId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const teamStep = await activeTeamStep(db, tenantId, workRequestId, teamStepId);
      if (!isAdmin && teamStep.team.leadMemberId !== memberId) throw forbidden();
      await requireTeamMembers(db, tenantId, teamStep.teamId, [targetMemberId]);
      const last = await db.workRequestMemberStep.findFirst({ where: { tenantId, teamStepId }, orderBy: { ordinal: 'desc' }, select: { ordinal: true } });
      if (!last) throw conflict('Define the Member sequence before appending.');
      const id = randomUUID();
      await db.workRequestMemberStep.create({ data: { id, tenantId, routeId: teamStep.routeId, teamStepId, ordinal: last.ordinal + 1, memberId: targetMemberId } });
      await event(db, tenantId, teamStep.routeId, actorId, 'MEMBER_STEP_APPENDED', { divisionCycleId: teamStep.divisionCycleId, teamStepId, memberStepId: id });
      return this.internalCycle(workRequestId, teamStep.divisionCycleId, memberId, isAdmin);
    }, { isolationLevel: 'Serializable' });
  }

  submitMemberStep(workRequestId: string, memberStepId: string, actorId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const step = await db.workRequestMemberStep.findFirst({ where: { id: memberStepId, tenantId, route: { is: { workRequestId } } }, include: { teamStep: { include: { divisionCycle: true } } } });
      if (!step || (!isAdmin && step.memberId !== memberId) || step.submittedAt || !step.activatedAt || step.teamStep.completedAt || step.teamStep.divisionCycle.completedAt) throw conflict('Only the active Member step may be submitted.');
      const projection = await db.workRequestRouteProjection.findFirst({ where: { tenantId, routeId: step.routeId }, select: { memberStepId: true } });
      if (projection?.memberStepId !== step.id) throw conflict('Only the active Member step may be submitted.');
      const now = new Date();
      await db.workRequestMemberStep.update({ where: { id: step.id }, data: { submittedAt: now } });
      const next = await db.workRequestMemberStep.findFirst({ where: { tenantId, teamStepId: step.teamStepId, ordinal: step.ordinal + 1, activatedAt: null, submittedAt: null } });
      if (next) await db.workRequestMemberStep.update({ where: { id: next.id }, data: { activatedAt: now } });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: step.routeId, tenantId } }, data: { memberStepId: next?.id ?? null, updatedAt: now } });
      await event(db, tenantId, step.routeId, actorId, 'MEMBER_STEP_SUBMITTED', { divisionCycleId: step.teamStep.divisionCycleId, teamStepId: step.teamStepId, memberStepId: step.id });
      return this.internalCycle(workRequestId, step.teamStep.divisionCycleId, memberId, isAdmin);
    }, { isolationLevel: 'Serializable' });
  }

  completeTeamStep(workRequestId: string, teamStepId: string, actorId: string, memberId: string | null, isAdmin = false) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const teamStep = await activeTeamStep(db, tenantId, workRequestId, teamStepId);
      if (!isAdmin && teamStep.team.leadMemberId !== memberId) throw forbidden();
      const pending = await db.workRequestMemberStep.count({ where: { tenantId, teamStepId, submittedAt: null } });
      if (pending) throw conflict('Every Member step must be submitted before Team completion.');
      const now = new Date();
      await db.workRequestTeamStep.update({ where: { id: teamStep.id }, data: { completedAt: now } });
      const next = await db.workRequestTeamStep.findFirst({ where: { tenantId, divisionCycleId: teamStep.divisionCycleId, ordinal: teamStep.ordinal + 1 } });
      if (next) await db.workRequestTeamStep.update({ where: { id: next.id }, data: { activatedAt: now } });
      else await db.workRequestDivisionCycle.update({ where: { id: teamStep.divisionCycleId }, data: { completedAt: now } });
      await db.workRequestRouteProjection.update({ where: { routeId_tenantId: { routeId: teamStep.routeId, tenantId } }, data: { teamStepId: next?.id ?? null, memberStepId: null, updatedAt: now } });
      await event(db, tenantId, teamStep.routeId, actorId, next ? 'TEAM_STEP_COMPLETED' : 'DIVISION_CYCLE_COMPLETED', { divisionCycleId: teamStep.divisionCycleId, teamStepId: teamStep.id });
      return this.internalCycle(workRequestId, teamStep.divisionCycleId, memberId, isAdmin);
    }, { isolationLevel: 'Serializable' });
  }
}

async function activeCycle(db: any, tenantId: string, workRequestId: string, cycleId: string) {
  const cycle = await db.workRequestDivisionCycle.findFirst({ where: { id: cycleId, tenantId, completedAt: null, route: { is: { workRequestId } } }, include: { routeStep: { select: { divisionId: true } }, route: { include: { projection: true } } } });
  if (!cycle || cycle.route.projection?.divisionCycleId !== cycleId) throw conflict('The Division cycle is not active.');
  return cycle;
}
async function activeTeamStep(db: any, tenantId: string, workRequestId: string, teamStepId: string) {
  const step = await db.workRequestTeamStep.findFirst({ where: { id: teamStepId, tenantId, activatedAt: { not: null }, completedAt: null, route: { is: { workRequestId } } }, include: { team: { select: { leadMemberId: true } }, divisionCycle: true, route: { include: { projection: true } } } });
  if (!step || step.divisionCycle.completedAt || step.route.projection?.teamStepId !== teamStepId) throw conflict('The Team step is not active.');
  return step;
}
async function requireDivisionLead(db: any, tenantId: string, divisionId: string | null, memberId: string) {
  if (!divisionId || !(await db.divisionLead.findFirst({ where: { tenantId, divisionId, memberId, revokedAt: null }, select: { id: true } }))) throw forbidden();
}
async function requireTeamMembers(db: any, tenantId: string, teamId: string, memberIds: string[]) {
  if (!memberIds.length || memberIds.length !== new Set(memberIds).size) throw bad('Member sequence targets must be unique.');
  const memberships = await db.teamMember.findMany({ where: { tenantId, teamId, memberId: { in: memberIds }, leftAt: null, member: { is: { isActive: true } } }, select: { memberId: true } });
  if (memberships.length !== memberIds.length) throw bad('Every Member must be active in the current Team.');
}
async function event(db: any, tenantId: string, routeId: string, performedByActorId: string, action: string, refs: Record<string, string>) {
  await db.workRequestRouteEvent.create({ data: { id: randomUUID(), tenantId, routeId, performedByActorId, action, ...refs } });
}
function executionActions(cycle: any, memberId: string | null, isDivisionLead: boolean, isAdmin: boolean) {
  const activeTeam = cycle.teamSteps.find((step: any) => step.activatedAt && !step.completedAt);
  const activeMember = activeTeam?.memberSteps.find((step: any) => step.activatedAt && !step.submittedAt);
  return [
    ...((isAdmin || isDivisionLead) && !cycle.completedAt && !cycle.teamSteps.length ? ['DEFINE_TEAM_SEQUENCE'] : []),
    ...((isAdmin || activeTeam?.team.leadMemberId === memberId) && !activeTeam?.memberSteps.length ? ['DEFINE_MEMBER_SEQUENCE'] : []),
    ...((isAdmin || activeTeam?.team.leadMemberId === memberId) && activeTeam?.memberSteps.length ? ['APPEND_MEMBER_STEP', ...(activeTeam.memberSteps.every((step: any) => step.submittedAt) ? ['COMPLETE_TEAM_STEP'] : [])] : []),
    ...(isAdmin || activeMember?.memberId === memberId ? ['SUBMIT_MEMBER_STEP'] : []),
  ];
}
function bad(message: string) { return new AppException({ code: AppErrorCode.BadRequest, status: HttpStatus.BAD_REQUEST, message }); }
function conflict(message: string) { return new AppException({ code: AppErrorCode.Conflict, status: HttpStatus.CONFLICT, message }); }
function forbidden() { return new AppException({ code: AppErrorCode.Forbidden, status: HttpStatus.FORBIDDEN, message: "You don't have permission to perform this action." }); }
function notFound() { return new AppException({ code: AppErrorCode.NotFound, status: HttpStatus.NOT_FOUND, message: 'Work Request execution cycle was not found.' }); }
