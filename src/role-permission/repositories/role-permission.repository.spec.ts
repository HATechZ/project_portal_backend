/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { RequestContext } from '../../common/context/request-context';
import { WorkflowActionCode } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RolePermissionRepository } from './role-permission.repository';

const tenantA = '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000002';
const roleId = '10000000-0000-4000-8000-000000000004';

describe('RolePermissionRepository tenant transactions', () => {
  const transaction = {
    workflowActionDefinition: { findMany: jest.fn() },
    workflowActionRolePermission: {
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const prisma = {
    workflowActionDefinition: { findMany: jest.fn() },
    role: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  let repository: RolePermissionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new RolePermissionRepository(
      prisma as unknown as PrismaService,
    );
    transaction.workflowActionDefinition.findMany.mockResolvedValue([
      { id: 'action-id' },
    ]);
    transaction.workflowActionRolePermission.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.workflowActionRolePermission.upsert.mockResolvedValue({});
    prisma.role.findUniqueOrThrow.mockResolvedValue({
      id: roleId,
      workflowActionRolePermissionsByRoleId: [],
    });
  });

  it('replaces grants atomically and scopes every grant write to the tenant', async () => {
    await RequestContext.run(
      { requestId: 'request-a', tenantId: tenantA },
      () =>
        repository.replaceRolePermissions(roleId, [
          WorkflowActionCode.ADD_PROJECT,
        ]),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(
      transaction.workflowActionRolePermission.updateMany,
    ).toHaveBeenCalledWith({
      where: { tenantId: tenantA, roleId },
      data: { allowed: false },
    });
    expect(
      transaction.workflowActionRolePermission.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_actionId_roleId: {
            tenantId: tenantA,
            actionId: 'action-id',
            roleId,
          },
        },
        create: expect.objectContaining({ tenantId: tenantA, roleId }),
      }),
    );
  });

  it('does not return a final matrix when a transactional grant write fails', async () => {
    transaction.workflowActionRolePermission.upsert.mockRejectedValue(
      new Error('write failed'),
    );

    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: tenantA }, () =>
        repository.replaceRolePermissions(roleId, [
          WorkflowActionCode.ADD_PROJECT,
        ]),
      ),
    ).rejects.toThrow('write failed');
    expect(prisma.role.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('builds independent role grant reads for separate tenants', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await RequestContext.run(
      { requestId: 'request-a', tenantId: tenantA },
      () => repository.findRole(roleId),
    );
    await RequestContext.run(
      { requestId: 'request-b', tenantId: tenantB },
      () => repository.findRole(roleId),
    );

    const firstSelect = prisma.role.findUnique.mock.calls[0][0].select;
    const secondSelect = prisma.role.findUnique.mock.calls[1][0].select;
    expect(
      firstSelect.workflowActionRolePermissionsByRoleId.where.tenantId,
    ).toBe(tenantA);
    expect(
      secondSelect.workflowActionRolePermissionsByRoleId.where.tenantId,
    ).toBe(tenantB);
  });

  it('filters only the UI-facing permission list by visibility', async () => {
    prisma.workflowActionDefinition.findMany.mockResolvedValue([]);

    await repository.findVisiblePermissions();
    await repository.findPermissions();

    expect(prisma.workflowActionDefinition.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { isUserVisible: true } }),
    );
    expect(prisma.workflowActionDefinition.findMany).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ where: expect.anything() }),
    );
  });
});
