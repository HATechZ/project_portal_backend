import { WorkRequestV1AssignmentLevelCode } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';
import { hasTenantWideInternalAuthority } from '../../common/security/tenant-internal-operations';

/**
 * The internal administrator can operate any internal Work Request
 * responsibility. Explicit permission, tenant/resource checks, and workflow
 * state validation remain mandatory at each command boundary.
 */
export function hasTenantSuperAdminRoutingAuthority(
  actor: SessionActor,
  _level: WorkRequestV1AssignmentLevelCode,
): boolean {
  return hasTenantWideInternalAuthority(actor);
}
