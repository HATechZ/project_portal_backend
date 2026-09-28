import { WorkflowActionCode } from '../../generated/prisma/client';
import {
  customRolePermissionCodes,
  isCustomRolePermissionAllowed,
  isCustomRoleScope,
} from './custom-role-policy';

describe('Custom Access Role V1 policy', () => {
  it('does not expose global or legacy persisted scopes to tenant custom roles', () => {
    expect(isCustomRoleScope('global')).toBe(false);
    expect(isCustomRoleScope('member')).toBe(false);
  });

  it.each([
    [
      'company',
      [
        WorkflowActionCode.ADD_MEMBER,
        WorkflowActionCode.ADD_TEAM,
        WorkflowActionCode.ASSIGN_MEMBER,
      ],
    ],
    [
      'division',
      [
        WorkflowActionCode.ADD_MEMBER,
        WorkflowActionCode.ADD_TEAM,
        WorkflowActionCode.ASSIGN_MEMBER,
      ],
    ],
    ['team', [WorkflowActionCode.ADD_MEMBER, WorkflowActionCode.ASSIGN_MEMBER]],
  ] as const)(
    'allows exactly the approved permissions for %s scope',
    (scope, expected) => {
      expect(customRolePermissionCodes(scope)).toEqual(expected);
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
    expect(
      isCustomRolePermissionAllowed('team', WorkflowActionCode.ADD_TEAM),
    ).toBe(false);
    expect(
      isCustomRolePermissionAllowed('company', WorkflowActionCode.ADD_COMPANY),
    ).toBe(false);
  });
});
