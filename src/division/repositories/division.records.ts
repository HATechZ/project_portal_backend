import { Prisma } from '../../generated/prisma/client';

export const divisionTypeSelect = {
  id: true,
  name: true,
  description: true,
} satisfies Prisma.DivisionTypeSelect;

export const divisionSelect = {
  id: true,
  name: true,
  abbr: true,
  divisionTypeId: true,
  divisionType: { select: divisionTypeSelect },
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DivisionSelect;

export type DivisionRecord = Prisma.DivisionGetPayload<{
  select: typeof divisionSelect;
}>;

export type DivisionTypeRecord = Prisma.DivisionTypeGetPayload<{
  select: typeof divisionTypeSelect;
}>;

export interface ScopedCompanyRecord {
  id: string;
}

export type DivisionDeleteBlocker =
  | 'membersByDivisionId'
  | 'teamsByDivisionId'
  | 'projectsByOriginDivisionId'
  | 'workRequestsByAssignedDivisionId'
  | 'workRequestsByOriginDivisionId';

export interface DivisionMutationInput {
  name?: string;
  abbr?: string;
  divisionTypeId?: string;
}
