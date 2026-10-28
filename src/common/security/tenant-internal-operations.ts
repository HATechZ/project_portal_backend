import { ActorRoleCode } from '../../generated/prisma/client';
import type { SessionActor } from './session.types';

/**
 * Identifies the tenant's system internal administrator. Callers must still
 * enforce the endpoint's explicit permission, tenant-scoped resource lookup,
 * and workflow/state rules. It intentionally excludes Client contexts.
 */
export function hasTenantWideInternalAuthority(actor: SessionActor): boolean {
  return (
    actor.role?.systemRole?.systemCode === ActorRoleCode.tenant_super_admin &&
    (actor.role?.customScope ?? null) === null &&
    actor.clientContact == null
  );
}
