import { CustomRoleScope as PrismaCustomRoleScope } from '../../generated/prisma/client';

/**
 * Scope values are system-defined. Permission compatibility is read from the
 * database catalogue; role names and categories have no authorization meaning.
 */
export const CUSTOM_ROLE_SCOPES = [
  PrismaCustomRoleScope.company,
  PrismaCustomRoleScope.division,
  PrismaCustomRoleScope.team,
  PrismaCustomRoleScope.member,
  PrismaCustomRoleScope.client,
  PrismaCustomRoleScope.client_contact,
] as const;
export type CustomRoleScope = (typeof CUSTOM_ROLE_SCOPES)[number];

export function isCustomRoleScope(value: string): value is CustomRoleScope {
  return CUSTOM_ROLE_SCOPES.includes(value as CustomRoleScope);
}
