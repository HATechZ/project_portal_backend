import {
  assertDatabaseRole,
  DatabaseRoleIdentity,
} from './database-role.assertion';

const appIdentity: DatabaseRoleIdentity = {
  currentUser: 'app_user',
  sessionUser: 'app_user',
  bypassRls: false,
  superuser: false,
  createRole: false,
  memberOfRelay: false,
  ownsPublicTables: false,
};

describe('assertDatabaseRole', () => {
  it('accepts a directly authenticated non-owner role', () => {
    expect(() =>
      assertDatabaseRole(appIdentity, 'app_user', false),
    ).not.toThrow();
  });

  it.each([
    [
      { ...appIdentity, currentUser: 'migration_owner' },
      'authenticate directly',
    ],
    [
      { ...appIdentity, sessionUser: 'migration_owner' },
      'authenticate directly',
    ],
    [{ ...appIdentity, bypassRls: true }, 'invalid BYPASSRLS'],
    [{ ...appIdentity, superuser: true }, 'unsafe administrative'],
    [{ ...appIdentity, createRole: true }, 'unsafe administrative'],
    [{ ...appIdentity, memberOfRelay: true }, 'must not inherit app_relay'],
    [{ ...appIdentity, ownsPublicTables: true }, 'must not own public tables'],
  ] as const)('rejects an unsafe runtime identity', (identity, message) => {
    expect(() => assertDatabaseRole(identity, 'app_user', false)).toThrow(
      message,
    );
  });
});
