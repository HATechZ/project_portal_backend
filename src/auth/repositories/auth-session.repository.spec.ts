import { RequestContext } from '../../common/context/request-context';
import { AuthSessionRepository } from './auth-session.repository';

const actor = (id: string, customCode: string, permissions: string[] = []) => ({
  id,
  roleId: `${id}-role`,
  memberId: 'member-id',
  clientContactId: null,
  label: customCode,
  isDefault: customCode === 'staff',
  isActive: true,
  role: {
    isActive: true,
    isSystemRole: false,
    customCode,
    customScope: 'member',
    systemRole: null,
    workflowActionRolePermissionsByRoleId: [],
    rolePermissions: permissions.map((code) => ({
      revokedAt: null,
      permission: { code, scopeCompatibilities: [{ scope: 'member' }] },
    })),
    userRolesByRoleId: [{ teamId: null }],
  },
  member: null,
  clientContact: null,
});

describe('AuthSessionRepository Staff acting-profile fallback', () => {
  function subject(...actors: Array<ReturnType<typeof actor> | null>) {
    const db = { actorProfile: { findFirst: jest.fn() } };
    db.actorProfile.findFirst.mockImplementation(() =>
      Promise.resolve(actors.shift() ?? null),
    );
    return {
      db,
      repository: new AuthSessionRepository({
        execute: async (work: (transaction: never) => Promise<unknown>) =>
          work(db as never),
      } as never),
    };
  }

  it('uses Staff only when it is the sole active custom context', async () => {
    const { repository } = subject(null, actor('staff-profile', 'staff', ['VIEW_BID']));

    await expect(
      RequestContext.run({ tenantId: 'tenant-id' } as never, () =>
        repository.findActiveActor('user-id'),
      ),
    ).resolves.toMatchObject({ id: 'staff-profile', role: { customCode: 'staff' } });
  });

  it('uses the non-Staff custom profile and does not union Staff permissions', async () => {
    const { repository, db } = subject(
      actor('marketing-profile', 'marketing_lead_ccr', ['CREATE_BID']),
    );

    const selected = await RequestContext.run(
      { tenantId: 'tenant-id' } as never,
      () => repository.findActiveActor('user-id'),
    );
    expect(selected).toMatchObject({
      id: 'marketing-profile',
      role: { customCode: 'marketing_lead_ccr' },
    });
    expect(selected?.role.rolePermissions.map(({ permission }) => permission.code)).toEqual([
      'CREATE_BID',
    ]);
    expect(db.actorProfile.findFirst).toHaveBeenCalledTimes(1);
  });

  it('uses the deterministic default ordering among multiple non-Staff roles', async () => {
    const { repository, db } = subject(
      actor('current-custom-profile', 'marketing_lead_ccr'),
    );

    await RequestContext.run({ tenantId: 'tenant-id' } as never, () =>
      repository.findActiveActor('user-id'),
    );

    expect(db.actorProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
    );
  });
});
