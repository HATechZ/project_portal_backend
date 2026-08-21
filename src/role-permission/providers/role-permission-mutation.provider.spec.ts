import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import { RolePermissionRepository, RoleRecord } from '../repositories';
import { RolePermissionMutationProvider } from './role-permission-mutation.provider';

const role = (
  code: ActorRoleCode = ActorRoleCode.division_lead,
): RoleRecord => ({
  id: '10000000-0000-4000-8000-000000000004',
  code,
  name: 'Division Lead',
  description: null,
  isSystemRole: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  workflowActionRolePermissionsByRoleId: [],
});

describe('RolePermissionMutationProvider', () => {
  let repository: {
    findRole: jest.Mock;
    findUser: jest.Mock;
    findActiveAssignment: jest.Mock;
    findPermissions: jest.Mock;
    createAssignment: jest.Mock;
    revokeAssignment: jest.Mock;
    replaceRolePermissions: jest.Mock;
  };
  let provider: RolePermissionMutationProvider;

  beforeEach(() => {
    repository = {
      findRole: jest.fn(),
      findUser: jest.fn(),
      findActiveAssignment: jest.fn(),
      findPermissions: jest.fn(),
      createAssignment: jest.fn(),
      revokeAssignment: jest.fn(),
      replaceRolePermissions: jest.fn(),
    };
    provider = new RolePermissionMutationProvider(
      repository as unknown as RolePermissionRepository,
    );
  });

  it('rejects duplicate active role assignments before inserting', async () => {
    repository.findUser.mockResolvedValue({ id: 'user-id' });
    repository.findRole.mockResolvedValue(role());
    repository.findActiveAssignment.mockResolvedValue({ id: 'assignment-id' });

    await expect(
      provider.assignUserRole(
        'user-id',
        { roleId: '10000000-0000-4000-8000-000000000004' },
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a new assignment after an earlier assignment was revoked', async () => {
    repository.findUser.mockResolvedValue({ id: 'user-id' });
    repository.findRole.mockResolvedValue(role());
    repository.findActiveAssignment.mockResolvedValue(null);
    repository.createAssignment.mockResolvedValue({
      id: 'new-assignment-id',
      userId: 'user-id',
      roleId: role().id,
      assignedByUserId: 'admin-id',
      assignedAt: new Date('2026-01-02T00:00:00.000Z'),
      revokedAt: null,
      role: role(),
    });

    const assignment = await provider.assignUserRole(
      'user-id',
      { roleId: role().id },
      'admin-id',
    );

    expect(assignment.id).toBe('new-assignment-id');
    expect(repository.createAssignment).toHaveBeenCalledTimes(1);
  });

  it('prevents an administrator from revoking their own admin role', async () => {
    repository.findUser.mockResolvedValue({ id: 'admin-id' });
    repository.findRole.mockResolvedValue(role(ActorRoleCode.system_admin));

    await expect(
      provider.revokeUserRole(
        'admin-id',
        '10000000-0000-4000-8000-000000000001',
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.revokeAssignment).not.toHaveBeenCalled();
  });

  it("preserves the tenant's final active system administrator", async () => {
    repository.findUser.mockResolvedValue({ id: 'other-admin-id' });
    repository.findRole.mockResolvedValue(role(ActorRoleCode.system_admin));
    repository.findActiveAssignment.mockResolvedValue({ id: 'assignment-id' });
    repository.revokeAssignment.mockResolvedValue(false);

    await expect(
      provider.revokeUserRole(
        'other-admin-id',
        '10000000-0000-4000-8000-000000000001',
        'current-admin-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects replacing grants when definitions have not been seeded', async () => {
    repository.findRole.mockResolvedValue(role());
    repository.findPermissions.mockResolvedValue([]);

    await expect(
      provider.setRolePermissions(role().id, {
        permissionCodes: [WorkflowActionCode.ADD_PROJECT],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('rejects duplicate permission codes even outside DTO validation', async () => {
    repository.findRole.mockResolvedValue(role());

    await expect(
      provider.setRolePermissions(role().id, {
        permissionCodes: [
          WorkflowActionCode.ADD_PROJECT,
          WorkflowActionCode.ADD_PROJECT,
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findPermissions).not.toHaveBeenCalled();
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });
});
