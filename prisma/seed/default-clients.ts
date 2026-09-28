import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { demoCompany } from './data/demo.data';

export const DEFAULT_CLIENTS = [
  {
    key: 'bluewater-marine-logistics',
    name: 'Bluewater Marine Logistics',
    contact: {
      name: 'Nadia Rahman',
      email: 'nadia.rahman@bluewater-marine.test',
      designation: 'Commercial Manager',
    },
  },
  {
    key: 'meridian-offshore-services',
    name: 'Meridian Offshore Services',
    contact: {
      name: 'Arif Hossain',
      email: 'arif.hossain@meridian-offshore.test',
      designation: 'Operations Director',
    },
  },
  {
    key: 'seaport-engineering-partners',
    name: 'Seaport Engineering Partners',
    contact: {
      name: 'Farzana Islam',
      email: 'farzana.islam@seaport-engineering.test',
      designation: 'Project Controls Lead',
    },
  },
] as const;

export type DefaultClientCompany = Readonly<{
  id: string;
  tenantId: string;
}>;

type DefaultClientWriter = Pick<PrismaClient, 'client' | 'clientContact'>;

const legacyDemoIds = [
  {
    clientId: '70000000-0000-4000-8000-000000000004',
    contactId: '70000000-0000-4000-8000-000000000005',
  },
  {
    clientId: '70000000-0000-4000-8000-000000000006',
    contactId: '70000000-0000-4000-8000-000000000007',
  },
  {
    clientId: '70000000-0000-4000-8000-000000000008',
    contactId: '70000000-0000-4000-8000-000000000009',
  },
] as const;

const legacyDemoClient = {
  name: 'Demo Client',
  contact: {
    name: 'Demo Client Contact',
    email: 'contact@demo-client.local',
    designation: 'Primary Contact',
  },
} as const;

function stableUuid(identity: string): string {
  const hex = createHash('sha256').update(identity).digest('hex');
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function defaultIds(companyId: string, index: number) {
  if (companyId === demoCompany.id) return legacyDemoIds[index];

  const key = DEFAULT_CLIENTS[index].key;
  return {
    clientId: stableUuid(`default-client:${companyId}:${key}`),
    contactId: stableUuid(`default-client-contact:${companyId}:${key}`),
  };
}

async function promoteUntouchedLegacyDemoClient(
  prisma: DefaultClientWriter,
  company: DefaultClientCompany,
): Promise<void> {
  if (company.id !== demoCompany.id) return;

  const { clientId, contactId } = legacyDemoIds[0];
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (
    client?.tenantId === company.tenantId &&
    client.companyId === company.id &&
    client.name === legacyDemoClient.name &&
    client.isActive
  ) {
    await prisma.client.update({
      where: { id: clientId },
      data: { name: DEFAULT_CLIENTS[0].name },
    });
  }

  const contact = await prisma.clientContact.findUnique({
    where: { id: contactId },
  });
  if (
    contact?.tenantId === company.tenantId &&
    contact.clientId === clientId &&
    contact.name === legacyDemoClient.contact.name &&
    contact.email === legacyDemoClient.contact.email &&
    contact.designation === legacyDemoClient.contact.designation &&
    contact.phone === null &&
    contact.userId === null &&
    contact.isPrimary &&
    contact.isActive
  ) {
    await prisma.clientContact.update({
      where: { id: contactId },
      data: {
        name: DEFAULT_CLIENTS[0].contact.name,
        email: DEFAULT_CLIENTS[0].contact.email,
        designation: DEFAULT_CLIENTS[0].contact.designation,
      },
    });
  }
}

/**
 * Creates the starter records only when their stable seed identities are absent.
 * Empty updates intentionally preserve every normal user edit on later seed runs.
 */
export async function initializeDefaultClients(
  prisma: DefaultClientWriter,
  company: DefaultClientCompany,
): Promise<void> {
  await promoteUntouchedLegacyDemoClient(prisma, company);

  for (const [index, item] of DEFAULT_CLIENTS.entries()) {
    const { clientId, contactId } = defaultIds(company.id, index);

    await prisma.client.upsert({
      where: { id: clientId },
      create: {
        id: clientId,
        tenantId: company.tenantId,
        companyId: company.id,
        name: item.name,
        isActive: true,
      },
      update: {},
    });
    await prisma.clientContact.upsert({
      where: { id: contactId },
      create: {
        id: contactId,
        tenantId: company.tenantId,
        clientId,
        name: item.contact.name,
        email: item.contact.email,
        designation: item.contact.designation,
        isPrimary: true,
        isActive: true,
      },
      update: {},
    });
  }
}
