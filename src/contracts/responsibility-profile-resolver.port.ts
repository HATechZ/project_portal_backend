import type { PermissionCode, Prisma } from '../generated/prisma/client';

export const RESPONSIBILITY_PROFILE_RESOLVER = Symbol(
  'RESPONSIBILITY_PROFILE_RESOLVER',
);

export type ResponsibilityProfileContext = {
  tenantId: string;
  workRequestId: string;
  routeId: string;
  divisionCycleId: string;
  memberId: string;
  requiredPermission: PermissionCode;
} & (
  | { responsibilityType: 'TEAM'; teamStepId: string }
  | { responsibilityType: 'DIVISION'; divisionLeadId: string }
);

export interface ResponsibilityProfileResolverPort {
  resolve(
    input: ResponsibilityProfileContext,
    tx: Prisma.TransactionClient,
  ): Promise<{
    actorProfileId: string;
    sourceUserId: string;
    sourceRoleId: string;
    sourceMemberId: string;
  }>;
}
