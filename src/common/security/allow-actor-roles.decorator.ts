import { SetMetadata } from '@nestjs/common';
import { ActorRoleCode } from '../../generated/prisma/client';

export const ALLOW_ACTOR_ROLES_KEY = 'allowActorRoles';

/**
 * Widens {@link SystemAdminGuard} for one route.
 *
 * `system_admin` is always admitted; this adds roles on top. Routes that do
 * not carry the decorator keep the guard's original system-admin-only
 * behavior, so adding it changes nothing anywhere else.
 *
 * It grants *role* admission only. Object scope is still decided downstream —
 * 04.1.1 DR-12 requires the Company check to run regardless of role.
 */
export const AllowActorRoles = (...roles: ActorRoleCode[]) =>
  SetMetadata(ALLOW_ACTOR_ROLES_KEY, roles);
