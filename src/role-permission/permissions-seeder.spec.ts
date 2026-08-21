/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { permissions } from '../../prisma/seed/data/permissions.data';
import {
  initializeTenantPermissions,
  permissionsSeeder,
} from '../../prisma/seed/seeders/permissions.seeder';
import { ActorRoleCode } from '../generated/prisma/client';

describe('permissions seeder', () => {
  const workflowActionDefinition = { upsert: jest.fn() };
  const workflowActionRolePermission = { upsert: jest.fn() };
  const prisma = {
    workflowActionDefinition,
    workflowActionRolePermission,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    workflowActionDefinition.upsert.mockImplementation(
      ({ create }: { create: { id: string; code: string } }) => create,
    );
    workflowActionRolePermission.upsert.mockImplementation(
      ({ create }: { create: unknown }) => create,
    );
  });

  it('is idempotent by tenant/role/action and does not reuse grant IDs across tenants', async () => {
    const runForTenant = (tenantId: string) =>
      permissionsSeeder.run({
        prisma: prisma as never,
        admin: {
          tenantId,
          email: 'admin@example.com',
          fullName: 'Admin',
          password: 'secret1',
        },
      });

    await runForTenant('00000000-0000-4000-8000-000000000001');
    const firstRun = workflowActionRolePermission.upsert.mock.calls.map(
      ([input]) => input,
    );
    workflowActionRolePermission.upsert.mockClear();
    await runForTenant('00000000-0000-4000-8000-000000000002');
    const secondRun = workflowActionRolePermission.upsert.mock.calls.map(
      ([input]) => input,
    );

    const expectedGrantCount =
      Object.values(ActorRoleCode).length * permissions.length;
    expect(firstRun).toHaveLength(expectedGrantCount);
    expect(secondRun).toHaveLength(expectedGrantCount);
    expect(new Set(firstRun.map((input) => input.create.id)).size).toBe(
      expectedGrantCount,
    );
    expect(secondRun[0].create.id).not.toBe(firstRun[0].create.id);
    expect(firstRun[0].where.tenantId_actionId_roleId.tenantId).not.toBe(
      secondRun[0].where.tenantId_actionId_roleId.tenantId,
    );
    expect(
      firstRun.every(
        (input) =>
          Object.keys((input as { update: object }).update).length === 0,
      ),
    ).toBe(true);
  });

  it('can initialize any supplied tenant without changing existing grants', async () => {
    const tenantA = '00000000-0000-4000-8000-000000000001';
    const tenantB = '00000000-0000-4000-8000-000000000002';

    await initializeTenantPermissions(prisma as never, tenantA);
    await initializeTenantPermissions(prisma as never, tenantB);

    const tenantIds = new Set(
      workflowActionRolePermission.upsert.mock.calls.map(
        ([input]) => input.where.tenantId_actionId_roleId.tenantId,
      ),
    );
    expect(tenantIds).toEqual(new Set([tenantA, tenantB]));
    expect(
      workflowActionRolePermission.upsert.mock.calls.every(
        ([input]) =>
          Object.keys((input as { update: object }).update).length === 0,
      ),
    ).toBe(true);
  });
});
