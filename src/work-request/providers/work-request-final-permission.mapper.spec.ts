import {
  PermissionCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import {
  DEFERRED_EXTERNAL_WORK_REQUEST_ACTIONS,
  getFinalPermissionForWorkRequestAction,
  getRouteCommandPermission,
  isRouteCommandAuthorized,
  WORK_REQUEST_FINAL_PERMISSION_BY_ACTION,
  WORK_REQUEST_ROUTE_COMMAND,
  WORK_REQUEST_ROUTE_COMMAND_POLICY,
} from './work-request-final-permission.mapper';
import { CustomRoleScope } from '../../generated/prisma/client';

describe('Work Request final permission mapping', () => {
  it('maps every Work Request runtime action to its frozen final capability', () => {
    expect(WORK_REQUEST_FINAL_PERMISSION_BY_ACTION).toMatchObject({
      [WorkflowActionCode.ADD_WORK_REQUEST]: PermissionCode.CREATE_WORK_REQUEST,
      [WorkflowActionCode.WR_ASSIGN_DIVISION]:
        PermissionCode.ASSIGN_WORK_REQUEST_DIVISION,
      [WorkflowActionCode.WR_SUBMIT]: PermissionCode.SUBMIT_WORK_REQUEST,
      [WorkflowActionCode.WR_CHECKING_APPROVE]:
        PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
      [WorkflowActionCode.WR_REQUEST_REVISION]:
        PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      [WorkflowActionCode.REQUEST_WORKFLOW_INFO]: PermissionCode.REQUEST_INFO,
      [WorkflowActionCode.RESPOND_WORKFLOW_INFO]:
        PermissionCode.RESPOND_TO_INFO_REQUEST,
    });
  });

  it('has no role-labelled final permission and fails closed for unmapped actions', () => {
    for (const permission of Object.values(
      WORK_REQUEST_FINAL_PERMISSION_BY_ACTION,
    )) {
      expect(permission).not.toMatch(/TMS|CCR|MARKETING|M[123]|LEAD/);
    }
    expect(() =>
      getFinalPermissionForWorkRequestAction(WorkflowActionCode.ADD_BID),
    ).toThrow('No final permission is mapped');
  });

  it('identifies external deferred actions explicitly', () => {
    expect(DEFERRED_EXTERNAL_WORK_REQUEST_ACTIONS).toEqual([]);
  });

  it('maps every Phase 2 through 7 route command to an existing generic permission', () => {
    expect(Object.keys(WORK_REQUEST_ROUTE_COMMAND_POLICY)).toHaveLength(
      Object.keys(WORK_REQUEST_ROUTE_COMMAND).length,
    );
    expect(
      getRouteCommandPermission(
        WORK_REQUEST_ROUTE_COMMAND.DEFINE_TEAM_SEQUENCE,
      ),
    ).toBe(PermissionCode.ASSIGN_WORK_REQUEST_TEAM);
    expect(
      getRouteCommandPermission(
        WORK_REQUEST_ROUTE_COMMAND.REQUEST_CROSS_DIVISION_FORMAL_REVISION,
      ),
    ).toBe(PermissionCode.REQUEST_WORK_REQUEST_REVISION);
    expect(
      getRouteCommandPermission(
        WORK_REQUEST_ROUTE_COMMAND.SUBMIT_CLIENT_PACKAGE,
      ),
    ).toBe(PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW);
    expect(
      getRouteCommandPermission(
        WORK_REQUEST_ROUTE_COMMAND.ACCEPT_RECONSIDERATION,
      ),
    ).toBe(PermissionCode.ACCEPT_FINAL_DELIVERY);
    expect(
      WORK_REQUEST_ROUTE_COMMAND_POLICY[WORK_REQUEST_ROUTE_COMMAND.AMEND_ROUTE]
        .responsibility,
    ).toBe('ROUTE_ORIGINATING_LEAD');
    expect(
      WORK_REQUEST_ROUTE_COMMAND_POLICY[
        WORK_REQUEST_ROUTE_COMMAND.ACCEPT_CLIENT_PACKAGE
      ].responsibility,
    ).toBe('LINKED_ACTIVE_CLIENT_CONTACT');
  });

  it.each([
    'hasPermission',
    'isActiveSameTenantActor',
    'hasResourceRelationship',
    'hasExactResponsibility',
    'hasValidWorkflowContext',
  ] as const)('denies a route command when %s is false', (deniedPredicate) => {
    const authorization = {
      command: WORK_REQUEST_ROUTE_COMMAND.AMEND_ROUTE,
      scope: CustomRoleScope.division,
      hasPermission: true,
      isActiveSameTenantActor: true,
      hasResourceRelationship: true,
      hasExactResponsibility: true,
      hasValidWorkflowContext: true,
    };
    authorization[deniedPredicate] = false;

    expect(isRouteCommandAuthorized(authorization)).toBe(false);
  });

  it('denies a permission-only or scope-incompatible route command', () => {
    expect(
      isRouteCommandAuthorized({
        command: WORK_REQUEST_ROUTE_COMMAND.AMEND_ROUTE,
        scope: CustomRoleScope.member,
        hasPermission: true,
        isActiveSameTenantActor: true,
        hasResourceRelationship: true,
        hasExactResponsibility: true,
        hasValidWorkflowContext: true,
      }),
    ).toBe(false);
    expect(
      isRouteCommandAuthorized({
        command: WORK_REQUEST_ROUTE_COMMAND.ACCEPT_CLIENT_PACKAGE,
        scope: CustomRoleScope.client_contact,
        hasPermission: true,
        isActiveSameTenantActor: true,
        hasResourceRelationship: true,
        hasExactResponsibility: true,
        hasValidWorkflowContext: true,
      }),
    ).toBe(true);
  });
});
