import type { PrismaClient } from '../generated/prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_CLIENTS,
  initializeDefaultClients,
} from '../../prisma/seed/default-clients';

type DefaultClientWriter = Pick<PrismaClient, 'client' | 'clientContact'>;
type ClientUpsertArgs = Parameters<PrismaClient['client']['upsert']>[0];
type ContactUpsertArgs = Parameters<PrismaClient['clientContact']['upsert']>[0];

function makePrismaMock() {
  const clientUpsert = jest.fn<Promise<unknown>, [ClientUpsertArgs]>();
  const contactUpsert = jest.fn<Promise<unknown>, [ContactUpsertArgs]>();

  return {
    prisma: {
      client: { upsert: clientUpsert },
      clientContact: { upsert: contactUpsert },
    } as unknown as DefaultClientWriter,
    clientUpsert,
    contactUpsert,
  };
}

describe('default client seed initializer', () => {
  const firstCompany = {
    id: '10000000-0000-4000-8000-000000000001',
    tenantId: '20000000-0000-4000-8000-000000000001',
  };

  it('creates three isolated clients with primary contacts for an existing company', async () => {
    const { prisma, clientUpsert, contactUpsert } = makePrismaMock();

    await initializeDefaultClients(prisma, firstCompany);

    expect(clientUpsert).toHaveBeenCalledTimes(3);
    expect(contactUpsert).toHaveBeenCalledTimes(3);
    expect(clientUpsert.mock.calls.map(([args]) => args.create.name)).toEqual(
      DEFAULT_CLIENTS.map((item) => item.name),
    );
    const firstClient = clientUpsert.mock.calls[0][0].create;
    expect(firstClient.tenantId).toBe(firstCompany.tenantId);
    expect(firstClient.companyId).toBe(firstCompany.id);
    expect(
      contactUpsert.mock.calls.every(([args]) => args.create.isPrimary),
    ).toBe(true);
  });

  it('gives another company distinct client identities in its own tenant', async () => {
    const first = makePrismaMock();
    const second = makePrismaMock();
    const anotherCompany = {
      id: '10000000-0000-4000-8000-000000000002',
      tenantId: '20000000-0000-4000-8000-000000000002',
    };

    await initializeDefaultClients(first.prisma, firstCompany);
    await initializeDefaultClients(second.prisma, anotherCompany);

    expect(
      second.clientUpsert.mock.calls.map(([args]) => args.create.id),
    ).not.toEqual(
      first.clientUpsert.mock.calls.map(([args]) => args.create.id),
    );
    expect(
      second.clientUpsert.mock.calls.every(
        ([args]) => args.create.companyId === anotherCompany.id,
      ),
    ).toBe(true);
    expect(
      second.contactUpsert.mock.calls.every(
        ([args]) => args.create.tenantId === anotherCompany.tenantId,
      ),
    ).toBe(true);
  });

  it('is repeat-safe and preserves editable client and contact fields', async () => {
    const { prisma, clientUpsert, contactUpsert } = makePrismaMock();

    await initializeDefaultClients(prisma, firstCompany);
    await initializeDefaultClients(prisma, firstCompany);

    expect(clientUpsert).toHaveBeenCalledTimes(6);
    expect(contactUpsert).toHaveBeenCalledTimes(6);
    expect(
      clientUpsert.mock.calls.every(
        ([args]) => Object.keys(args.update).length === 0,
      ),
    ).toBe(true);
    expect(
      contactUpsert.mock.calls.every(
        ([args]) => Object.keys(args.update).length === 0,
      ),
    ).toBe(true);
    expect(
      clientUpsert.mock.calls.slice(0, 3).map(([args]) => args.where.id),
    ).toEqual(clientUpsert.mock.calls.slice(3).map(([args]) => args.where.id));
    expect(
      contactUpsert.mock.calls.slice(0, 3).map(([args]) => args.where.id),
    ).toEqual(contactUpsert.mock.calls.slice(3).map(([args]) => args.where.id));
  });

  it('provisions the same three normal records inside new-company provisioning', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260928000200_provision_default_company_clients/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('WITH default_clients');
    expect(migration).toContain('INSERT INTO public.clients');
    expect(migration).toContain('INSERT INTO public.client_contacts');
    for (const item of DEFAULT_CLIENTS) {
      expect(migration).toContain(item.name);
      expect(migration).toContain(item.contact.name);
    }
  });
});
