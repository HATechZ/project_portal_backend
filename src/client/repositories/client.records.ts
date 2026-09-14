import { Prisma } from '../../generated/prisma/client';

export const clientSelect = {
  id: true,
  companyId: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

export const clientContactSelect = {
  id: true,
  userId: true,
  clientId: true,
  name: true,
  email: true,
  designation: true,
  phone: true,
  isPrimary: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientContactSelect;

export type ClientRecord = Prisma.ClientGetPayload<{
  select: typeof clientSelect;
}>;

export type ClientContactRecord = Prisma.ClientContactGetPayload<{
  select: typeof clientContactSelect;
}>;

export interface ScopedCompanyRecord {
  id: string;
}

export interface PortalAccessRecord {
  client: Pick<ClientRecord, 'id' | 'name'>;
  clientContact: Pick<ClientContactRecord, 'id' | 'name' | 'email' | 'userId'>;
  setupRequired: boolean;
}
