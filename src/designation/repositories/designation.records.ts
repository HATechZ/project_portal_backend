import { Prisma } from '../../generated/prisma/client';

export const designationSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DesignationSelect;

export type DesignationRecord = Prisma.DesignationGetPayload<{
  select: typeof designationSelect;
}>;
