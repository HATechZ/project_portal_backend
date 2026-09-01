export interface DatabaseRoleIdentity {
  currentUser: string;
  sessionUser: string;
  bypassRls: boolean;
  superuser: boolean;
  createRole: boolean;
  memberOfRelay: boolean;
  ownsPublicTables: boolean;
}

export function assertDatabaseRole(
  identity: DatabaseRoleIdentity | undefined,
  expectedRole: string,
  expectedBypassRls: boolean,
): void {
  if (!identity) throw new Error(`Database role ${expectedRole} was not found`);
  if (
    identity.currentUser !== expectedRole ||
    identity.sessionUser !== expectedRole
  ) {
    throw new Error(
      `Database connection must authenticate directly as ${expectedRole}`,
    );
  }
  if (identity.bypassRls !== expectedBypassRls) {
    throw new Error(
      `Database role ${expectedRole} has an invalid BYPASSRLS setting`,
    );
  }
  if (identity.superuser || identity.createRole) {
    throw new Error(
      `Database role ${expectedRole} has unsafe administrative attributes`,
    );
  }
  if (identity.memberOfRelay) {
    throw new Error('Database role app_user must not inherit app_relay');
  }
  if (identity.ownsPublicTables) {
    throw new Error(`Database role ${expectedRole} must not own public tables`);
  }
}
