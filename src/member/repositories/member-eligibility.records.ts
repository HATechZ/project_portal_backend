import { Prisma } from '../../generated/prisma/client';

export const eligibleMemberSelect = (
  tenantId: string,
  companyId: string,
  divisionId: string,
) =>
  ({
    id: true,
    name: true,
    email: true,
    teamMembersByMemberId: {
      where: {
        tenantId,
        leftAt: null,
        team: { tenantId, companyId, divisionId, isActive: true },
      },
      orderBy: [{ team: { name: 'asc' as const } }, { teamId: 'asc' as const }],
      select: {
        teamRole: true,
        team: { select: { id: true, name: true, leadMemberId: true } },
      },
    },
    teamsByLeadMemberId: {
      where: { tenantId, companyId, divisionId, isActive: true },
      orderBy: [{ name: 'asc' as const }, { id: 'asc' as const }],
      select: { id: true, name: true },
    },
  }) satisfies Prisma.MemberSelect;

export type EligibleMemberRecord = Prisma.MemberGetPayload<{
  select: ReturnType<typeof eligibleMemberSelect>;
}>;
