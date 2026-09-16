import { WorkflowActionCode } from '../../generated/prisma/client';
import {
  customRolePermissionCodes,
  isCustomRolePermissionAllowed,
} from './custom-role-policy';

describe('Custom Access Role V1 policy', () => {
  it.each(['division', 'company'] as const)(
    'allows exactly the approved permissions for %s scope',
    (scope) => {
      expect(customRolePermissionCodes(scope)).toEqual([
        WorkflowActionCode.ADD_MEMBER,
        WorkflowActionCode.ADD_TEAM,
        WorkflowActionCode.ASSIGN_MEMBER,
      ]);
    },
  );

  it('rejects workflow-routing and administration actions', () => {
    expect(
      isCustomRolePermissionAllowed(
        'division',
        WorkflowActionCode.ASSIGN_LEADER,
      ),
    ).toBe(false);
    expect(
      isCustomRolePermissionAllowed(
        'company',
        WorkflowActionCode.MANAGE_CLIENT,
      ),
    ).toBe(false);
  });
});
