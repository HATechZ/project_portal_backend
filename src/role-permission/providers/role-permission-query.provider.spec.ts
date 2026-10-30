import { type CustomRoleScope } from './custom-role-policy';
import { toRoleResponse } from './role-permission.mapper';
import { RolePermissionQueryProvider } from './role-permission-query.provider';

const permission = (
  id: string,
  code: string,
  scopes: string[],
  category = 'MEMBERS',
) => ({
  id,
  code,
  displayName: code,
  description: null,
  category,
  actionType: 'VIEW',
  resource: 'Member',
  scopeCompatibilities: scopes.map((scope) => ({ scope })),
});

const scopeCases: {
  scope: CustomRoleScope;
  expected: string[];
}[] = [
  {
    scope: 'company',
    expected: ['CREATE_COMPANY', 'VIEW_MEMBERS', 'VIEW_DOCUMENT'],
  },
  {
    scope: 'division',
    expected: ['VIEW_MEMBERS'],
  },
  {
    scope: 'team',
    expected: ['VIEW_DOCUMENT'],
  },
];

describe('RolePermissionQueryProvider custom-role permission selector', () => {
  const catalogue = [
    permission('1', 'CREATE_COMPANY', ['company'], 'ORGANIZATION'),
    permission('2', 'VIEW_MEMBERS', ['company', 'division']),
    permission(
      '3',
      'VIEW_DOCUMENT',
      ['company', 'team', 'client', 'client_contact'],
      'DOCUMENTS',
    ),
  ];
  const repository = {
    findVisiblePermissions: jest.fn().mockResolvedValue(catalogue),
    findPermission: jest.fn((id: string) =>
      Promise.resolve(
        catalogue.find((candidate) => candidate.id === id) ?? null,
      ),
    ),
  };
  const provider = new RolePermissionQueryProvider(
    repository as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each(scopeCases)(
    'returns only $scope-eligible custom-role permissions',
    async ({ scope, expected }) => {
      await expect(
        provider.findPermissions(true, scope),
      ).resolves.toMatchObject(expected.map((code) => ({ code })));
      expect(repository.findVisiblePermissions).toHaveBeenCalledTimes(1);
    },
  );

  it('uses persisted compatibility rather than role labels', async () => {
    const result = await provider.findPermissions(true, 'company');
    expect(result.map(({ code }) => code)).toContain('CREATE_COMPANY');
    expect(result.map(({ code }) => code)).toContain('VIEW_DOCUMENT');
  });

  it('returns multi-category permissions in one flat list', async () => {
    const result = await provider.findPermissions(false, 'team');
    expect(result.map(({ category }) => category)).toEqual([
      'ORGANIZATION',
      'MEMBERS',
      'DOCUMENTS',
    ]);
  });

  it('filters a selected module only after applying scope compatibility', async () => {
    const result = await provider.findPermissions(true, 'company', 'DOCUMENTS');

    expect(result).toEqual([
      expect.objectContaining({
        code: 'VIEW_DOCUMENT',
        module: 'DOCUMENTS',
      }),
    ]);
  });

  it('omits a module that has no permissions for the selected scope', async () => {
    await expect(
      provider.findPermissions(true, 'team', 'ORGANIZATION'),
    ).resolves.toEqual([]);
  });

  it('returns only the public compatibleScopes field for permission responses', async () => {
    const [result] = await provider.findPermissions(false);

    expect(result).toMatchObject({
      compatibleScopes: ['company'],
      module: 'ORGANIZATION',
    });
    expect(result).not.toHaveProperty('scopeCompatibilities');
  });

  it('normalizes a permission detail response', async () => {
    const result = await provider.findPermission('2');

    expect(result).toMatchObject({
      id: '2',
      compatibleScopes: ['company', 'division'],
    });
    expect(result).not.toHaveProperty('scopeCompatibilities');
  });

  it('normalizes permission records nested under a Role response', () => {
    const response = toRoleResponse({
      id: 'role-1',
      customCode: 'quality_reviewer',
      customScope: 'company',
      systemRole: null,
      name: 'Quality reviewer',
      description: null,
      isSystemRole: false,
      createdAt: new Date(),
      rolePermissions: [{ permission: catalogue[1] }],
    });

    expect(response.permissions).toEqual([
      expect.objectContaining({
        id: '2',
        compatibleScopes: ['company', 'division'],
      }),
    ]);
    expect(response.permissions[0]).not.toHaveProperty('scopeCompatibilities');
  });
});
