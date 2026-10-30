import { CustomRoleScope, PermissionCode } from '../../generated/prisma/client';

export const STARTER_ROLES = [
  {
    name: 'Staff',
    code: 'staff',
    scope: CustomRoleScope.member,
    permissions: [
      PermissionCode.VIEW_MEMBERS,
      PermissionCode.VIEW_BID,
      PermissionCode.VIEW_PROJECT,
      PermissionCode.VIEW_WORK_REQUEST,
      PermissionCode.VIEW_DOCUMENT,
    ],
  },
  {
    name: 'Supervisor',
    code: 'supervisor',
    scope: CustomRoleScope.team,
    permissions: [
      PermissionCode.VIEW_MEMBERS,
      PermissionCode.VIEW_BID,
      PermissionCode.VIEW_PROJECT,
      PermissionCode.VIEW_WORK_REQUEST,
      PermissionCode.VIEW_DOCUMENT,
      PermissionCode.VIEW_TEAMS,
      PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
      PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
      PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      PermissionCode.REQUEST_INFO,
      PermissionCode.RESPOND_TO_INFO_REQUEST,
    ],
  },
  {
    name: 'Manager',
    code: 'manager',
    scope: CustomRoleScope.division,
    permissions: [
      PermissionCode.VIEW_MEMBERS,
      PermissionCode.VIEW_BID,
      PermissionCode.VIEW_PROJECT,
      PermissionCode.VIEW_WORK_REQUEST,
      PermissionCode.VIEW_DOCUMENT,
      PermissionCode.VIEW_TEAMS,
      PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      PermissionCode.REQUEST_INFO,
      PermissionCode.RESPOND_TO_INFO_REQUEST,
      PermissionCode.VIEW_DIVISIONS,
      PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
    ],
  },
] as const;

export type StarterRoleCode = (typeof STARTER_ROLES)[number]['code'];

export function starterRole(code: string) {
  return STARTER_ROLES.find((role) => role.code === code);
}

export function isStarterRoleCode(
  code: string | null,
): code is StarterRoleCode {
  return STARTER_ROLES.some((role) => role.code === code);
}
