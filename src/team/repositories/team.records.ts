import { Prisma } from '../../generated/prisma/client';

export const teamMemberSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.MemberSelect;

export const teamSelect = {
  id: true,
  companyId: true,
  divisionId: true,
  name: true,
  leadMemberId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  leadMember: { select: teamMemberSummarySelect },
} satisfies Prisma.TeamSelect;

export const teamMemberSelect = {
  id: true,
  teamId: true,
  memberId: true,
  teamRole: true,
  joinedAt: true,
  leftAt: true,
  member: { select: teamMemberSummarySelect },
} satisfies Prisma.TeamMemberSelect;

export type TeamRecord = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;

export type TeamMemberRecord = Prisma.TeamMemberGetPayload<{
  select: typeof teamMemberSelect;
}>;

export interface ScopedCompanyRecord {
  id: string;
}

export interface ScopedDivisionRecord {
  id: string;
  companyId: string;
}

export interface TeamMemberEligibilityRecord {
  id: string;
  companyId: string;
  divisionId: string;
  isActive: boolean;
}

export interface TeamCreateInput {
  divisionId: string;
  name: string;
  leadMemberId?: string;
}
