import { Prisma } from '../../generated/prisma/client';

export const memberDivisionSelect = {
  id: true,
  name: true,
  abbr: true,
} satisfies Prisma.DivisionSelect;

export const memberSelect = {
  id: true,
  userId: true,
  companyId: true,
  divisionId: true,
  designationId: true,
  name: true,
  email: true,
  designation: { select: { name: true } },
  isActive: true,
  createdAt: true,
  updatedAt: true,
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
  designationId?: string;
  divisionId?: string;
  isActive?: boolean;
}

export type MemberDeleteBlocker =
  | 'actorProfilesByMemberId'
  | 'divisionLeadsByMemberId'
  | 'teamsByLeadMemberId'
  | 'teamMembersByMemberId'
  | 'workRequestAssignmentsByMemberId'
  | 'workflowInfoRequestsByRequestedByMemberId'
  | 'workflowInfoRequestsByTargetMemberId'
  | 'workRequestRevisionRequestsByRequestedToMemberId';
