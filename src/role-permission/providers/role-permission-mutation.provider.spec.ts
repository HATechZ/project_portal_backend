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
  rolePermissions: [],
  ...overrides,
});

describe('RolePermissionMutationProvider custom-role eligibility', () => {
  const repository = {
    findPermissionsByIds: jest.fn().mockResolvedValue([]),
    findPermissionDependencyGraph: jest.fn().mockResolvedValue([]),
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

  const memberPermission = '10000000-0000-4000-8000-000000000001';
  const teamPermission = '10000000-0000-4000-8000-000000000002';

  it('creates a role with compatible explicit permission IDs', async () => {
    repository.findPermissionsByIds.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }] },
    ]);
    repository.findPermissionDependencyGraph.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [] },
    ]);
    await expect(
      provider.createCustomRole({
        name: 'Team coordinator',
        scope: 'team',
        permissionIds: [memberPermission],
      }),
    ).resolves.toMatchObject({ id: role().id });
    expect(customRoles.create).toHaveBeenCalled();
  });

  it('rejects a missing transitive dependency and accepts its complete set', async () => {
    const dependency = '10000000-0000-4000-8000-000000000003';
    repository.findPermissionsByIds.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'team' }] },
      { id: dependency, scopeCompatibilities: [{ scope: 'team' }] },
    ]);
    repository.findPermissionDependencyGraph.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [{ requiredPermissionId: teamPermission }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [{ requiredPermissionId: dependency }] },
      { id: dependency, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [] },
    ]);
    await expect(provider.createCustomRole({ name: 'Reviewer', scope: 'team', permissionIds: [memberPermission] })).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    await expect(provider.createCustomRole({ name: 'Reviewer', scope: 'team', permissionIds: [memberPermission, teamPermission, dependency] })).resolves.toMatchObject({ id: role().id });
  });

  it('rejects incompatible and circular catalogue dependencies', async () => {
    repository.findPermissionsByIds.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'company' }] },
    ]);
    repository.findPermissionDependencyGraph.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [{ requiredPermissionId: teamPermission }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'company' }], requiredPermissionDependencies: [] },
    ]);
    await expect(provider.createCustomRole({ name: 'Reviewer', scope: 'team', permissionIds: [memberPermission, teamPermission] })).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    repository.findPermissionsByIds.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'team' }] },
    ]);
    repository.findPermissionDependencyGraph.mockResolvedValue([
      { id: memberPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [{ requiredPermissionId: teamPermission }] },
      { id: teamPermission, scopeCompatibilities: [{ scope: 'team' }], requiredPermissionDependencies: [{ requiredPermissionId: memberPermission }] },
    ]);
    await expect(provider.createCustomRole({ name: 'Reviewer', scope: 'team', permissionIds: [memberPermission, teamPermission] })).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('rejects a create with a scope-ineligible permission', async () => {
    repository.findPermissionsByIds.mockResolvedValueOnce([
      { id: teamPermission, scopeCompatibilities: [{ scope: 'company' }] },
    ]);
    await expect(
      provider.createCustomRole({
        name: 'Team coordinator',
        scope: 'team',
        permissionIds: [teamPermission],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('rejects a non-tenant custom-role scope even outside controller DTO validation', async () => {
    await expect(
      provider.createCustomRole({
        name: 'Invalid scope',
        scope: 'global' as never,
        permissionIds: [memberPermission],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('rejects a scope update that retains an incompatible permission', async () => {
    repository.findPermissionsByIds.mockResolvedValueOnce([
      { id: teamPermission, scopeCompatibilities: [{ scope: 'company' }] },
    ]);
    await expect(
      provider.setRolePermissions(role().id, {
        scope: 'team',
        permissionIds: [teamPermission],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('prevents changing a protected starter role scope while retaining compatible grants', async () => {
    repository.findRole.mockResolvedValueOnce(
      role({ customCode: 'staff', customScope: 'member' }),
    );
    await expect(
      provider.setRolePermissions(role().id, {
        scope: 'team',
        permissionIds: [],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  it('rejects duplicate permission IDs', async () => {
    await expect(
      provider.createCustomRole({
        name: 'Reviewer',
        scope: 'company',
        permissionIds: [memberPermission, memberPermission],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
  });

  it('blocks system-role permission replacement', async () => {
    repository.findRole.mockResolvedValueOnce(role({ isSystemRole: true }));
    await expect(
      provider.setRolePermissions(role().id, {
        permissionIds: [memberPermission],
      }),
    ).rejects.toMatchObject({ code: AppErrorCode.Forbidden });
  });
});
