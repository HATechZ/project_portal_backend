import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { ResponsibilityHistoryPort } from '../../contracts/work-request-responsibility-history.port';
import type { ResponsibilityProfileResolverPort } from '../../contracts/responsibility-profile-resolver.port';
import { PermissionCode, Prisma } from '../../generated/prisma/client';
import type { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';

type Dependencies = {
  history: ResponsibilityHistoryPort;
  profiles: ResponsibilityProfileResolverPort;
};

type DivisionInput = Dependencies & {
  db: PrismaExecutor;
  tenantId: string;
  workRequestId: string;
  routeId: string;
  divisionCycleId: string;
  divisionId: string;
  startedAt: Date;
  divisionLeadIds?: string[];
};

type TeamInput = Dependencies & {
  db: PrismaExecutor;
  tenantId: string;
  workRequestId: string;
  routeId: string;
  divisionCycleId: string;
  teamStepId: string;
  teamLeadMemberId: string;
  startedAt: Date;
};

/**
 * Opens proven Division responsibility intervals in the caller's ambient
 * transaction.  The current DivisionLead rows are the only incoming source;
 * a route transition never attributes responsibility to its performer.
 */
export async function recordDivisionResponsibilities(
  input: DivisionInput,
): Promise<void> {
  const leads = await input.db.divisionLead.findMany({
    where: {
      tenantId: input.tenantId,
      divisionId: input.divisionId,
      revokedAt: null,
      ...(input.divisionLeadIds ? { id: { in: input.divisionLeadIds } } : {}),
    },
    select: { id: true, memberId: true },
    orderBy: { id: 'asc' },
  });
  if (!leads.length) throw unresolved();
  for (const lead of leads) {
    const identity = await input.profiles.resolve(
      {
        tenantId: input.tenantId,
        workRequestId: input.workRequestId,
        routeId: input.routeId,
        divisionCycleId: input.divisionCycleId,
        responsibilityType: 'DIVISION',
        divisionLeadId: lead.id,
        memberId: lead.memberId,
        requiredPermission: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
      },
      input.db as Prisma.TransactionClient,
    );
    await input.history.recordAssignment(
      {
        tenantId: input.tenantId,
        workRequestId: input.workRequestId,
        routeId: input.routeId,
        actorProfileId: identity.actorProfileId,
        sourceMemberId: identity.sourceMemberId,
        sourceUserId: identity.sourceUserId,
        sourceRoleId: identity.sourceRoleId,
        selectionPolicy: 'CONTEXT_UNIQUE',
        responsibilityType: 'DIVISION',
        divisionCycleId: input.divisionCycleId,
        teamStepId: null,
        sourceDivisionLeadId: lead.id,
        assignmentKey: `division:${input.divisionCycleId}:${lead.id}`,
        startedAt: input.startedAt,
      },
      input.db as Prisma.TransactionClient,
    );
  }
}

/** Opens the one exact active Team Lead responsibility for an activated step. */
export async function recordTeamResponsibility(
  input: TeamInput,
): Promise<void> {
  const identity = await input.profiles.resolve(
    {
      tenantId: input.tenantId,
      workRequestId: input.workRequestId,
      routeId: input.routeId,
      divisionCycleId: input.divisionCycleId,
      responsibilityType: 'TEAM',
      teamStepId: input.teamStepId,
      memberId: input.teamLeadMemberId,
      requiredPermission: PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
    },
    input.db as Prisma.TransactionClient,
  );
  await input.history.recordAssignment(
    {
      tenantId: input.tenantId,
      workRequestId: input.workRequestId,
      routeId: input.routeId,
      actorProfileId: identity.actorProfileId,
      sourceMemberId: identity.sourceMemberId,
      sourceUserId: identity.sourceUserId,
      sourceRoleId: identity.sourceRoleId,
      selectionPolicy: 'CONTEXT_UNIQUE',
      responsibilityType: 'TEAM',
      divisionCycleId: input.divisionCycleId,
      teamStepId: input.teamStepId,
      sourceDivisionLeadId: null,
      assignmentKey: `team:${input.teamStepId}`,
      startedAt: input.startedAt,
    },
    input.db as Prisma.TransactionClient,
  );
}

export async function endTeamResponsibilities(
  db: PrismaExecutor,
  history: ResponsibilityHistoryPort,
  tenantId: string,
  teamStepId: string,
  endedAt: Date,
): Promise<void> {
  const rows = await db.workRequestResponsibilityHistory.findMany({
    where: {
      tenantId,
      responsibilityType: 'TEAM',
      teamStepId,
      endedAt: null,
    },
    select: { assignmentKey: true },
  });
  for (const row of rows)
    await history.endAssignment(
      tenantId,
      requiredAssignmentKey(row.assignmentKey),
      endedAt,
      db as Prisma.TransactionClient,
    );
}

export async function endDivisionResponsibilities(
  db: PrismaExecutor,
  history: ResponsibilityHistoryPort,
  tenantId: string,
  divisionCycleId: string,
  endedAt: Date,
  sourceDivisionLeadId?: string,
): Promise<void> {
  const rows = await db.workRequestResponsibilityHistory.findMany({
    where: {
      tenantId,
      responsibilityType: 'DIVISION',
      divisionCycleId,
      endedAt: null,
      ...(sourceDivisionLeadId ? { sourceDivisionLeadId } : {}),
    },
    select: { assignmentKey: true },
  });
  for (const row of rows)
    await history.endAssignment(
      tenantId,
      requiredAssignmentKey(row.assignmentKey),
      endedAt,
      db as Prisma.TransactionClient,
    );
}

/** Synchronizes active Work Request TeamSteps after a Team Lead change. */
export async function replaceTeamLeadResponsibilities(
  input: Dependencies & {
    db: PrismaExecutor;
    tenantId: string;
    teamId: string;
    teamLeadMemberId: string | null;
    changedAt: Date;
  },
): Promise<void> {
  const steps = await input.db.workRequestTeamStep.findMany({
    where: {
      tenantId: input.tenantId,
      teamId: input.teamId,
      activatedAt: { not: null },
      completedAt: null,
      divisionCycle: { is: { completedAt: null } },
    },
    select: {
      id: true,
      routeId: true,
      divisionCycleId: true,
      route: { select: { workRequestId: true } },
    },
    orderBy: { id: 'asc' },
  });
  for (const step of steps) {
    await endTeamResponsibilities(
      input.db,
      input.history,
      input.tenantId,
      step.id,
      input.changedAt,
    );
    if (input.teamLeadMemberId)
      await recordTeamResponsibility({
        ...input,
        workRequestId: step.route.workRequestId,
        routeId: step.routeId,
        divisionCycleId: step.divisionCycleId,
        teamStepId: step.id,
        teamLeadMemberId: input.teamLeadMemberId,
        startedAt: input.changedAt,
      });
  }
}

/** Synchronizes active Division cycles when a particular DivisionLead changes. */
export async function replaceDivisionLeadResponsibilities(
  input: Dependencies & {
    db: PrismaExecutor;
    tenantId: string;
    divisionId: string;
    priorDivisionLeadId: string | null;
    currentDivisionLeadId: string | null;
    changedAt: Date;
  },
): Promise<void> {
  const cycles = await input.db.workRequestDivisionCycle.findMany({
    where: {
      tenantId: input.tenantId,
      completedAt: null,
      routeStep: { is: { divisionId: input.divisionId } },
    },
    select: {
      id: true,
      routeId: true,
      route: { select: { workRequestId: true } },
    },
    orderBy: { id: 'asc' },
  });
  for (const cycle of cycles) {
    if (input.priorDivisionLeadId)
      await endDivisionResponsibilities(
        input.db,
        input.history,
        input.tenantId,
        cycle.id,
        input.changedAt,
        input.priorDivisionLeadId,
      );
    if (input.currentDivisionLeadId)
      await recordDivisionResponsibilities({
        ...input,
        workRequestId: cycle.route.workRequestId,
        routeId: cycle.routeId,
        divisionCycleId: cycle.id,
        divisionId: input.divisionId,
        divisionLeadIds: [input.currentDivisionLeadId],
        startedAt: input.changedAt,
      });
  }
}

function requiredAssignmentKey(value: string | null): string {
  if (!value) throw new Error('Responsibility interval has no retry identity.');
  return value;
}

function unresolved(): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message:
      'The responsible actor cannot be uniquely resolved for this Work Request.',
  });
}
