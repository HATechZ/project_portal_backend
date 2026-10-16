import {
  ActorRoleCode,
  WorkRequestV1AssignmentLevelCode,
} from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';

const INITIAL_ROUTING_LEVELS = new Set<WorkRequestV1AssignmentLevelCode>([
  WorkRequestV1AssignmentLevelCode.DIVISION,
  WorkRequestV1AssignmentLevelCode.TEAM,
  WorkRequestV1AssignmentLevelCode.MEMBER,
]);

/**
 * Narrow exception for administrative Work Request routing only. Explicit
 * permission, request/target validation, and transition checks remain with
 * their callers; this only replaces the actor-Member prerequisite.
 */
export function hasTenantSuperAdminRoutingAuthority(
  actor: SessionActor,
  level: WorkRequestV1AssignmentLevelCode,
): boolean {
  return (
    INITIAL_ROUTING_LEVELS.has(level) &&
    actor.role.systemRole?.systemCode === ActorRoleCode.tenant_super_admin
  );
}
