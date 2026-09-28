import { ObjectScopeProvider } from './object-scope.provider';
import { sessionActorSelect, withBoundTeamId } from './session.types';

describe('ObjectScopeProvider team grant binding', () => {
  it('loads boundTeamId from the exact active tenant-local UserRole grant', () => {
    const actor = {
      id: 'actor-id',
      roleId: 'role-id',
      role: {
        isSystemRole: false,
        customScope: 'team',
        systemRole: null,
        userRolesByRoleId: [{ teamId: 'team-id' }],
      },
      member: null,
      clientContact: null,
    };

    const sessionActor = withBoundTeamId(actor as never);
    expect(sessionActor.boundTeamId).toBe('team-id');
    expect(new ObjectScopeProvider().resolve(sessionActor)).toMatchObject({
      boundTeamId: 'team-id',
      customScope: 'team',
    });
  });

  it('selects the grant only for the active actor user and tenant', () => {
    const select = sessionActorSelect('tenant-a', 'user-a');
    expect(select.role.select.userRolesByRoleId).toMatchObject({
      where: { tenantId: 'tenant-a', userId: 'user-a', revokedAt: null },
    });
  });
});
