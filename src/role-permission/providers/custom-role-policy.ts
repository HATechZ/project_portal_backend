import { WorkflowActionCode } from '../../generated/prisma/client';

/** The deliberately small, server-authoritative Custom Access Role V1 matrix. */
export const CUSTOM_ROLE_SCOPES = ['division', 'company'] as const;
export type CustomRoleScope = (typeof CUSTOM_ROLE_SCOPES)[number];

const permitted = new Set<WorkflowActionCode>([
  WorkflowActionCode.ADD_MEMBER,
  WorkflowActionCode.ADD_TEAM,
  WorkflowActionCode.ASSIGN_MEMBER,
]);

export function isCustomRoleScope(value: string): value is CustomRoleScope {
  return CUSTOM_ROLE_SCOPES.includes(value as CustomRoleScope);
}

export function isCustomRolePermissionAllowed(
  scope: CustomRoleScope,
  code: WorkflowActionCode,
): boolean {
  return isCustomRoleScope(scope) && permitted.has(code);
}

export function customRolePermissionCodes(
  scope: CustomRoleScope,
): WorkflowActionCode[] {
  return isCustomRoleScope(scope) ? [...permitted] : [];
}
