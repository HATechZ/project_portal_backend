import { WorkflowActionCode } from '../../generated/prisma/client';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { RolePermissionMutationProvider } from './role-permission-mutation.provider';

const role = (overrides: Record<string, unknown> = {}) => ({
  id: '10000000-0000-4000-8000-000000000001',
  isSystemRole: false,
  customScope: 'company',
  customCode: 'custom_role',
  name: 'Custom role',
  description: null,
  createdAt: new Date(),
  tenantId: '20000000-0000-4000-8000-000000000001',
  systemRole: null,
  workflowActionRolePermissionsByRoleId: [],
  ...overrides,
});

describe('RolePermissionMutationProvider custom-role eligibility', () => {
  const repository = {
    findPermissions: jest
      .fn()
      .mockResolvedValue([
        { code: WorkflowActionCode.ADD_MEMBER },
        { code: WorkflowActionCode.ADD_TEAM },
        { code: WorkflowActionCode.ASSIGN_MEMBER },
        { code: WorkflowActionCode.ADD_COMPANY },
      ]),
    findRole: jest.fn().mockResolvedValue(role()),
    replaceRolePermissions: jest.fn().mockResolvedValue(role()),
  };
  const customRoles = { create: jest.fn().mockResolvedValue(role()) };
  const provider = new RolePermissionMutationProvider(
    repository as never,
    {} as never,
    customRoles as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a role with eligible permissions', async () => {
    await expect(
      provider.createCustomRole({
        name: 'Team coordinator',
        scope: 'team',
        permissionCodes: [WorkflowActionCode.ADD_MEMBER],
      }),
    ).resolves.toMatchObject({ id: role().id });
    expect(customRoles.create).toHaveBeenCalled();
  });

  it('rejects a create with a scope-ineligible permission', async () => {
    await expect(
      provider.createCustomRole({
        name: 'Team coordinator',
        scope: 'team',
        permissionCodes: [WorkflowActionCode.ADD_TEAM],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('rejects a non-tenant custom-role scope even outside controller DTO validation', async () => {
    await expect(
      provider.createCustomRole({
        name: 'Invalid scope',
        scope: 'global' as never,
        permissionCodes: [WorkflowActionCode.ADD_MEMBER],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('rejects a scope update that retains an incompatible permission', async () => {
    await expect(
      provider.setRolePermissions(role().id, {
        scope: 'team',
        permissionCodes: [WorkflowActionCode.ADD_TEAM],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('leaves fixed-role permission replacement behavior intact', async () => {
    repository.findRole.mockResolvedValueOnce(role({ isSystemRole: true }));
    await provider.setRolePermissions(role().id, {
      permissionCodes: [WorkflowActionCode.ADD_COMPANY],
    });
    expect(repository.replaceRolePermissions).toHaveBeenCalledWith(role().id, [
      WorkflowActionCode.ADD_COMPANY,
    ]);
  });
});
