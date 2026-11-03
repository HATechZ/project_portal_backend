import { RequestContext } from '../../common/context/request-context';
import { RolePermissionRepository } from './role-permission.repository';

const tenantId = '20000000-0000-4000-8000-000000000001';
const roleId = '10000000-0000-4000-8000-000000000001';
const permissionA = '30000000-0000-4000-8000-000000000001';
const permissionB = '30000000-0000-4000-8000-000000000002';
const permissionC = '30000000-0000-4000-8000-000000000003';

function subject(grants: Array<{ id: string; permissionId: string; revokedAt: Date | null }>) {
  const transaction = {
    permission: { findMany: jest.fn().mockResolvedValue([]) },
    role: { updateMany: jest.fn(), findFirstOrThrow: jest.fn().mockResolvedValue({ id: roleId }) },
    rolePermission: {
      findMany: jest.fn().mockResolvedValue(grants),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userRole: { update: jest.fn() },
  };
  const unitOfWork = {
    execute: jest.fn((work: (db: typeof transaction) => Promise<unknown>) => work(transaction)),
  };
  return { repository: new RolePermissionRepository(unitOfWork as never), transaction, unitOfWork };
}

async function replace(
  repository: RolePermissionRepository,
  permissionIds: string[],
) {
  return RequestContext.run({ requestId: 'request-id', tenantId }, () =>
    repository.replaceRolePermissions(roleId, permissionIds),
  );
}

describe('RolePermissionRepository permission synchronization', () => {
  it('preserves unchanged active grants while adding only new permissions', async () => {
    const { repository, transaction } = subject([
      { id: 'grant-a', permissionId: permissionA, revokedAt: null },
    ]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionA }, { id: permissionB }]);

    await replace(repository, [permissionA, permissionB]);

    expect(transaction.rolePermission.updateMany).not.toHaveBeenCalled();
    expect(transaction.rolePermission.update).not.toHaveBeenCalled();
    expect(transaction.rolePermission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId, roleId, permissionId: permissionB }),
    });
  });

  it('revokes only active grants removed from the requested effective set', async () => {
    const { repository, transaction } = subject([
      { id: 'grant-a', permissionId: permissionA, revokedAt: null },
      { id: 'grant-b', permissionId: permissionB, revokedAt: null },
    ]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionA }]);

    await replace(repository, [permissionA]);

    expect(transaction.rolePermission.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['grant-b'] } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction.rolePermission.create).not.toHaveBeenCalled();
  });

  it('reactivates an existing revoked grant instead of creating a duplicate row', async () => {
    const { repository, transaction } = subject([
      { id: 'grant-a', permissionId: permissionA, revokedAt: new Date() },
    ]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionA }]);

    await replace(repository, [permissionA]);

    expect(transaction.rolePermission.update).toHaveBeenCalledWith({
      where: { id: 'grant-a' },
      data: { revokedAt: null },
    });
    expect(transaction.rolePermission.create).not.toHaveBeenCalled();
  });

  it('keeps complete dependency assignments unchanged', async () => {
    const { repository, transaction } = subject([
      { id: 'grant-a', permissionId: permissionA, revokedAt: null },
      { id: 'grant-b', permissionId: permissionB, revokedAt: null },
    ]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionA }, { id: permissionB }]);

    await replace(repository, [permissionA, permissionB]);

    expect(transaction.rolePermission.updateMany).not.toHaveBeenCalled();
    expect(transaction.rolePermission.update).not.toHaveBeenCalled();
    expect(transaction.rolePermission.create).not.toHaveBeenCalled();
  });

  it('updates grants without altering member role assignments', async () => {
    const { repository, transaction } = subject([
      { id: 'grant-a', permissionId: permissionA, revokedAt: null },
    ]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionA }, { id: permissionB }]);

    await replace(repository, [permissionA, permissionB]);

    expect(transaction.userRole.update).not.toHaveBeenCalled();
    expect(transaction.rolePermission.create).toHaveBeenCalledTimes(1);
  });

  it('propagates a persistence failure so the unit-of-work rolls back the entire update', async () => {
    const { repository, transaction, unitOfWork } = subject([]);
    transaction.permission.findMany.mockResolvedValue([{ id: permissionC }]);
    transaction.rolePermission.create.mockRejectedValueOnce(new Error('constraint failure'));

    await expect(replace(repository, [permissionC])).rejects.toThrow('constraint failure');
    expect(unitOfWork.execute).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(transaction.role.findFirstOrThrow).not.toHaveBeenCalled();
  });
});
