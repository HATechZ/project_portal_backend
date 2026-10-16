import {
  ActorRoleCode,
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
} from '../../generated/prisma/client';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';
import { hasTenantSuperAdminRoutingAuthority } from './work-request-routing-authority';

describe('hasTenantSuperAdminRoutingAuthority', () => {
  const actor = (systemCode: ActorRoleCode) =>
    ({
      role: {
        systemRole: { systemCode },
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(
                WorkflowActionCode.WR_ASSIGN_DIVISION,
              ),
            },
          },
        ],
      },
    }) as never;

  it.each([Level.DIVISION, Level.TEAM, Level.MEMBER])(
    'allows tenant_super_admin only for %s routing',
    (level) => {
      expect(
        hasTenantSuperAdminRoutingAuthority(
          actor(ActorRoleCode.tenant_super_admin),
          level,
        ),
      ).toBe(true);
    },
  );

  it.each([
    Level.CHECKING,
    Level.APPROVAL,
    Level.FINAL_REVIEW,
    Level.EXTERNAL_REVIEW,
  ])('does not extend routing authority to %s responsibility', (level) => {
    expect(
      hasTenantSuperAdminRoutingAuthority(
        actor(ActorRoleCode.tenant_super_admin),
        level,
      ),
    ).toBe(false);
  });

  it('rejects a non-system routing role', () => {
    expect(
      hasTenantSuperAdminRoutingAuthority(
        actor(ActorRoleCode.division_head),
        Level.DIVISION,
      ),
    ).toBe(false);
  });
});
