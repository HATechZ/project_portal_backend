import { validate } from 'class-validator';
import { RequestContext } from '../../common/context/request-context';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import { RolePermissionMutationProvider } from './role-permission-mutation.provider';
import { SetRolePermissionsDto } from '../dtos/set-role-permissions.dto';

const tenantId = 'tenant-a';
const permissionId = '10000000-0000-4000-8000-000000000001';
function subject(initialScope = 'division') {
  const state = {
    scope: initialScope,
    grants: [{ id: 'grant-a', permissionId, revokedAt: null as Date | null }],
  };
  const permission = {
    id: permissionId,
    code: 'VIEW_MEMBERS',
    displayName: 'View members',
    description: null,
    category: 'MEMBERS',
    actionType: 'VIEW',
    resource: 'Member',
    scopeCompatibilities: ['company', 'division', 'team', 'member'].map(
      (scope) => ({ scope }),
    ),
    requiredPermissionDependencies: [],
  };
  const catalogue = [permission];
  const role = () => ({
    id: 'role-a',
    tenantId,
    customCode: 'reviewer',
    customScope: state.scope,
    isSystemRole: false,
    systemRole: null,
    name: 'Reviewer',
    description: null,
    createdAt: new Date(),
    rolePermissions: state.grants
      .filter((g) => !g.revokedAt)
      .map((grant) => ({
        permission: catalogue.find(({ id }) => id === grant.permissionId)!,
      })),
  });
  const db = {
    $executeRaw: jest.fn(),
    permission: {
      findMany: jest
        .fn()
        .mockImplementation((query: { where?: { id: { in: string[] } } }) =>
          Promise.resolve(
            query.where
              ? catalogue.filter(({ id }) => query.where!.id.in.includes(id))
              : catalogue,
          ),
        ),
    },
    role: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(role())),
      findFirstOrThrow: jest
        .fn()
        .mockImplementation(() => Promise.resolve(role())),
      updateMany: jest
        .fn()
        .mockImplementation(({ data }: { data: { customScope: string } }) => {
          state.scope = data.customScope;
          return Promise.resolve({ count: 1 });
        }),
    },
    rolePermission: {
      findMany: jest
        .fn()
        .mockImplementation(() => Promise.resolve(state.grants)),
      updateMany: jest
        .fn()
        .mockImplementation(({ data }: { data: { revokedAt: Date } }) => {
          state.grants[0].revokedAt = data.revokedAt;
          return Promise.resolve({ count: 1 });
        }),
      update: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(
          ({ data }: { data: { id: string; permissionId: string } }) => {
            state.grants.push({ ...data, revokedAt: null });
            return Promise.resolve(data);
          },
        ),
    },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    actorProfile: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    scoped: {
      $transaction: jest.fn(
        async (work: (transaction: typeof db) => Promise<unknown>) => {
          const snapshot = structuredClone(state);
          try {
            return await work(db);
          } catch (error) {
            Object.assign(state, snapshot);
            throw error;
          }
        },
      ),
    },
  };
  const repository = new RolePermissionRepository(
    new UnitOfWorkService(prisma as never),
  );
  const provider = new RolePermissionMutationProvider(
    repository,
    {} as never,
    {} as never,
  );
  const save = (input: SetRolePermissionsDto) =>
    RequestContext.run({ tenantId, requestId: 'scope-test' }, () =>
      provider.setRolePermissions('role-a', input),
    );
  return { save, state, db, prisma, permission, catalogue };
}

describe('custom role scope editing', () => {
  it.each([
    ['division', 'company'],
    ['team', 'division'],
    ['member', 'team'],
    ['company', 'division'],
  ])('preserves compatible grants on %s -> %s', async (from, scope) => {
    const { save, state, db, prisma } = subject(from);
    await expect(save({ scope: scope as never })).resolves.toMatchObject({
      scope,
      permissions: [{ id: permissionId }],
    });
    expect(state.scope).toBe(scope);
    expect(db.rolePermission.updateMany).not.toHaveBeenCalled();
    expect(db.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.scoped.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.scoped.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('accepts scope-only DTOs but rejects an empty update', async () => {
    expect(
      await validate(
        Object.assign(new SetRolePermissionsDto(), { scope: 'company' }),
      ),
    ).toEqual([]);
    expect(await validate(new SetRolePermissionsDto())).not.toEqual([]);
    expect(
      await validate(
        Object.assign(new SetRolePermissionsDto(), { scope: null }),
      ),
    ).not.toEqual([]);
  });

  it('identifies incompatible current permissions before any writes', async () => {
    const { save, permission, state, db } = subject();
    permission.scopeCompatibilities = [{ scope: 'division' }];
    await expect(save({ scope: 'company' })).rejects.toMatchObject({
      details: {
        canSave: false,
        incompatiblePermissions: [
          { id: permissionId, code: 'VIEW_MEMBERS', name: 'View members' },
        ],
      },
    });
    expect(state.scope).toBe('division');
    expect(db.role.updateMany).not.toHaveBeenCalled();
    expect(db.rolePermission.updateMany).not.toHaveBeenCalled();
  });

  it('allows an explicit replacement set to remove incompatible permissions atomically', async () => {
    const { save, state, permission, db } = subject();
    permission.scopeCompatibilities = [{ scope: 'division' }];
    db.permission.findMany.mockResolvedValue([]);
    await expect(
      save({ scope: 'company', permissionIds: [] }),
    ).resolves.toMatchObject({ scope: 'company', permissions: [] });
    expect(state.grants[0].revokedAt).toBeInstanceOf(Date);
  });

  it('rejects legacy Team bindings without changing scope or grants', async () => {
    const { save, db, state } = subject();
    db.userRole.findMany.mockResolvedValue([
      { id: 'assignment-a', userId: 'user-a', teamId: 'team-a' },
    ]);
    db.actorProfile.findMany.mockResolvedValue([
      {
        id: 'profile-a',
        userId: 'user-a',
        memberId: null,
        clientContactId: null,
      },
    ]);
    await expect(save({ scope: 'company' })).rejects.toMatchObject({
      details: {
        canSave: false,
        affectedBindings: [{ id: 'assignment-a', type: 'userRole' }],
      },
    });
    expect(state.scope).toBe('division');
    expect(state.grants[0].revokedAt).toBeNull();
    expect(db.role.updateMany).not.toHaveBeenCalled();
  });

  it('preserves existing Member-backed users and scopes every binding query to the tenant', async () => {
    const { save, db } = subject();
    db.userRole.findMany.mockResolvedValue([
      { id: 'assignment-a', userId: 'user-a', teamId: null },
    ]);
    db.actorProfile.findMany.mockResolvedValue([
      {
        id: 'profile-a',
        userId: 'user-a',
        memberId: 'member-a',
        clientContactId: null,
        member: {
          tenantId,
          userId: 'user-a',
          isActive: true,
          division: { isActive: true },
          company: { isActive: true },
        },
      },
    ]);
    await expect(save({ scope: 'company' })).resolves.toMatchObject({
      scope: 'company',
    });
    expect(db.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId, roleId: 'role-a', revokedAt: null },
      }),
    );
    expect(db.actorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          roleId: 'role-a',
        }) as unknown,
      }),
    );
    expect(db.role.updateMany).toHaveBeenCalledWith({
      where: { id: 'role-a', tenantId, isSystemRole: false },
      data: { customScope: 'company' },
    });
  });

  it('rejects an internal Member target when changing to an external scope', async () => {
    const { save, db, permission } = subject();
    permission.scopeCompatibilities = [{ scope: 'client' }];
    db.userRole.findMany.mockResolvedValue([
      { id: 'assignment-a', userId: 'user-a', teamId: null },
    ]);
    db.actorProfile.findMany.mockResolvedValue([
      {
        id: 'profile-a',
        userId: 'user-a',
        memberId: 'member-a',
        clientContactId: null,
      },
    ]);
    await expect(save({ scope: 'client' })).rejects.toMatchObject({
      details: {
        canSave: false,
        affectedBindings: [{ id: 'profile-a', type: 'actorProfile' }],
      },
    });
    expect(db.role.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back scope and grant writes if persistence fails', async () => {
    const { save, db, state } = subject();
    db.permission.findMany.mockResolvedValue([]);
    db.role.findFirstOrThrow.mockRejectedValueOnce(
      new Error('persistence failure'),
    );
    await expect(save({ scope: 'company', permissionIds: [] })).rejects.toThrow(
      'persistence failure',
    );
    expect(db.role.updateMany).toHaveBeenCalled();
    expect(db.rolePermission.updateMany).toHaveBeenCalled();
    expect(state.scope).toBe('division');
    expect(state.grants[0].revokedAt).toBeNull();
  });

  it('does not write a role outside the current tenant', async () => {
    const { save, db } = subject();
    db.role.findFirst.mockResolvedValueOnce(null);
    await expect(save({ scope: 'company' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(db.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'role-a',
          OR: [{ isSystemRole: true }, { tenantId }],
        }) as unknown,
      }),
    );
    expect(db.role.updateMany).not.toHaveBeenCalled();
  });
  it('persists a new scope and a nonempty replacement permission set together', async () => {
    const { save, state, permission, catalogue, db } = subject();
    permission.scopeCompatibilities = [{ scope: 'division' }];
    const newId = '10000000-0000-4000-8000-000000000002';
    catalogue.push({
      ...permission,
      id: newId,
      scopeCompatibilities: [{ scope: 'company' }],
    });
    await expect(
      save({ scope: 'company', permissionIds: [newId] }),
    ).resolves.toMatchObject({
      scope: 'company',
      permissions: [{ id: newId }],
    });
    expect(state.grants[0].revokedAt).toBeInstanceOf(Date);
    expect(db.rolePermission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        roleId: 'role-a',
        permissionId: newId,
      }) as unknown,
    });
  });

  it.each(['inactive', 'foreign-tenant', 'missing-profile'])(
    'blocks %s assignment evidence before updating the role',
    async (condition) => {
      const { save, db } = subject();
      db.userRole.findMany.mockResolvedValue([
        { id: 'assignment-a', userId: 'user-a', teamId: null },
      ]);
      if (condition !== 'missing-profile')
        db.actorProfile.findMany.mockResolvedValue([
          {
            id: 'profile-a',
            userId: 'user-a',
            memberId: 'member-a',
            clientContactId: null,
            member: {
              tenantId: condition === 'foreign-tenant' ? 'tenant-b' : tenantId,
              userId: 'user-a',
              isActive: condition !== 'inactive',
              division: { isActive: true },
              company: { isActive: true },
            },
          },
        ]);
      await expect(save({ scope: 'company' })).rejects.toMatchObject({
        details: { canSave: false },
      });
      expect(db.role.updateMany).not.toHaveBeenCalled();
    },
  );
  it('saves division -> company after removing reported incompatibilities and repeats idempotently', async () => {
    const { save, state, db, permission, catalogue } = subject();
    permission.scopeCompatibilities = [{ scope: 'division' }];
    const keptId = '10000000-0000-4000-8000-000000000002';
    catalogue.push({
      ...permission,
      id: keptId,
      code: 'VIEW_TEAMS',
      scopeCompatibilities: [{ scope: 'division' }, { scope: 'company' }],
    });
    state.grants.push({
      id: 'grant-kept',
      permissionId: keptId,
      revokedAt: null,
    });
    db.userRole.findMany.mockResolvedValue([
      { id: 'assignment-a', userId: 'user-a', teamId: null },
    ]);
    db.actorProfile.findMany.mockResolvedValue([
      {
        id: 'profile-a',
        userId: 'user-a',
        memberId: null,
        clientContactId: null,
      },
    ]);
    // Mirror the live immediate constraint trigger. The tenant extension includes
    // tenant_id in this UPDATE, even though only revokedAt was requested.
    db.rolePermission.updateMany.mockImplementation(
      ({ data }: { data: { revokedAt: Date } }) => {
        expect(state.scope).toBe('division');
        state.grants[0].revokedAt = data.revokedAt;
        return Promise.resolve({ count: 1 });
      },
    );
    await expect(save({ scope: 'company' })).rejects.toMatchObject({
      details: {
        incompatiblePermissions: [
          { id: permissionId, code: 'VIEW_MEMBERS', name: 'View members' },
        ],
      },
    });
    expect(db.role.updateMany).not.toHaveBeenCalled();
    await expect(
      save({ scope: 'company', permissionIds: [keptId] }),
    ).resolves.toMatchObject({
      scope: 'company',
      permissions: [{ id: keptId }],
    });
    expect(state.grants[0].revokedAt).toBeInstanceOf(Date);
    expect(state.grants[1]).toEqual({
      id: 'grant-kept',
      permissionId: keptId,
      revokedAt: null,
    });
    expect(
      db.rolePermission.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(db.role.updateMany.mock.invocationCallOrder[0]);
    await expect(
      save({ scope: 'company', permissionIds: [keptId] }),
    ).resolves.toMatchObject({
      scope: 'company',
      permissions: [{ id: keptId }],
    });
    expect(db.rolePermission.updateMany).toHaveBeenCalledTimes(1);
    expect(db.rolePermission.create).not.toHaveBeenCalled();
    expect(db.rolePermission.update).not.toHaveBeenCalled();
    expect(state.grants).toHaveLength(2);
  });
});
