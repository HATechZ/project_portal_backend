import { Prisma } from '../../generated/prisma/client';

export const memberDivisionSelect = {
  id: true,
  name: true,
  abbr: true,
} satisfies Prisma.DivisionSelect;

export const memberUserSelect = {
  id: true,
  fullName: true,
  email: true,
} satisfies Prisma.UserSelect;

export const memberSelect = {
  id: true,
  userId: true,
  companyId: true,
  divisionId: true,
  name: true,
  email: true,
  roleTitle: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  division: { select: memberDivisionSelect },
  user: { select: memberUserSelect },
} satisfies Prisma.MemberSelect;

export type MemberRecord = Prisma.MemberGetPayload<{
  select: typeof memberSelect;
}>;

export interface ScopedCompanyRecord {
  id: string;
}

export interface ScopedDivisionRecord {
  id: string;
  companyId: string;
}

export interface MemberMutationInput {
  name?: string;
  email?: string;
  roleTitle?: string;
  divisionId?: string;
  isActive?: boolean;
}

export type MemberDeleteBlocker =
  | 'actorProfilesByMemberId'
  | 'teamsByLeadMemberId'
  | 'teamMembersByMemberId'
  | 'workRequestAssignmentsByMemberId'
  | 'workflowInfoRequestsByRequestedByMemberId'
  | 'workflowInfoRequestsByTargetMemberId'
  | 'workRequestRevisionRequestsByRequestedToMemberId';
