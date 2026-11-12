import type { Prisma } from '../generated/prisma/client';

export const RESPONSIBILITY_HISTORY = Symbol('RESPONSIBILITY_HISTORY');

export interface ResponsibilityAssignment {
  tenantId: string;
  workRequestId: string;
  routeId: string;
  actorProfileId: string;
  sourceMemberId: string;
  sourceUserId: string;
  sourceRoleId: string;
  selectionPolicy: 'CONTEXT_UNIQUE';
  responsibilityType: 'TEAM' | 'DIVISION';
  divisionCycleId: string;
  teamStepId: string | null;
  sourceDivisionLeadId: string | null;
  assignmentKey: string;
  startedAt: Date;
}

export interface ResponsibilityHistoryPort {
  recordAssignment(
    input: ResponsibilityAssignment,
    tx: Prisma.TransactionClient,
  ): Promise<void>;
  endAssignment(
    tenantId: string,
    assignmentKey: string,
    endedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void>;
}
