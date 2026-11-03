import { validate } from 'class-validator';
import { CreateCustomRoleDto } from './dtos/create-custom-role.dto';
import { SetRolePermissionsDto } from './dtos/set-role-permissions.dto';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionMutationProvider } from './providers/role-permission-mutation.provider';

const scopes = ['company', 'division', 'team', 'member'] as const;
const permissionId = '10000000-0000-4000-8000-000000000001';

describe('dynamic role scope catalogue', () => {
  it('exposes every supported scope without requiring an existing role', () => {
    const service = new RolePermissionService({} as never, {} as never);
    const controller = new RolePermissionController(service);
    expect(controller.findRoleScopes()).toEqual({
      scopes: [...scopes, 'client', 'client_contact'],
    });
    const response = service.findRoleScopes();
    response.scopes.pop();
    expect(service.findRoleScopes().scopes).toHaveLength(6);
  });

  it.each(scopes)(
    'accepts %s in create and permission-update DTOs',
    async (scope) => {
      const input = { name: 'Reviewer', scope, permissionIds: [permissionId] };
      expect(
        await validate(Object.assign(new CreateCustomRoleDto(), input)),
      ).toEqual([]);
      expect(
        await validate(
          Object.assign(new SetRolePermissionsDto(), {
            scope,
            permissionIds: [permissionId],
          }),
        ),
      ).toEqual([]);
    },
  );

  it.each(scopes)('creates and updates a compatible %s role', async (scope) => {
    const role = {
      id: 'role',
      customCode: 'reviewer',
      customScope: scope,
      systemRole: null,
      isSystemRole: false,
      name: 'Reviewer',
      description: null,
      createdAt: new Date(),
      rolePermissions: [],
    };
    const permission = {
      id: permissionId,
      scopeCompatibilities: [{ scope }],
      requiredPermissionDependencies: [],
    };
    const repository = {
      withRoleMutation: jest.fn((work: () => Promise<unknown>) => work()),
      findAffectedScopeBindings: jest.fn().mockResolvedValue([]),
      findRole: jest.fn().mockResolvedValue(role),
      findPermissionsByIds: jest.fn().mockResolvedValue([permission]),
      findPermissionDependencyGraph: jest.fn().mockResolvedValue([permission]),
      replaceRolePermissions: jest.fn().mockResolvedValue(role),
    };
    const customRoles = { create: jest.fn().mockResolvedValue(role) };
    const provider = new RolePermissionMutationProvider(
      repository as never,
      {} as never,
      customRoles as never,
    );
    await expect(
      provider.createCustomRole({
        name: 'Reviewer',
        scope,
        permissionIds: [permissionId],
      }),
    ).resolves.toMatchObject({ scope });
    await expect(
      provider.setRolePermissions('role', {
        scope,
        permissionIds: [permissionId],
      }),
    ).resolves.toMatchObject({ scope });
    expect(repository.replaceRolePermissions).toHaveBeenCalledWith(
      'role',
      [permissionId],
      scope,
    );
  });
});
