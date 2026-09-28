import { WorkflowActionCode } from '../../generated/prisma/client';

/**
 * Server-authoritative custom-role catalog metadata. Scope identifies where a
 * role operates; a permission's allowedScopes identifies where it can safely
 * be granted. Fixed-role grants deliberately do not use this policy.
 */
export const CUSTOM_ROLE_SCOPES = ['company', 'division', 'team'] as const;
export type CustomRoleScope = (typeof CUSTOM_ROLE_SCOPES)[number];

type CustomRolePermissionMetadata = {
  customRoleAssignable: true;
  allowedScopes: readonly CustomRoleScope[];
};

const CUSTOM_ROLE_PERMISSION_CATALOG: Readonly<
  Partial<Record<WorkflowActionCode, CustomRolePermissionMetadata>>
> = {
  [WorkflowActionCode.ADD_MEMBER]: {
    customRoleAssignable: true,
    allowedScopes: ['company', 'division', 'team'],
  },
  [WorkflowActionCode.ADD_TEAM]: {
    customRoleAssignable: true,
    allowedScopes: ['company', 'division'],
  },
  [WorkflowActionCode.ASSIGN_MEMBER]: {
    customRoleAssignable: true,
    allowedScopes: ['company', 'division', 'team'],
  },
};

export function isCustomRoleScope(value: string): value is CustomRoleScope {
  return CUSTOM_ROLE_SCOPES.includes(value as CustomRoleScope);
}

export function isCustomRolePermissionAllowed(
  scope: CustomRoleScope,
  code: WorkflowActionCode,
): boolean {
  return Boolean(
    isCustomRoleScope(scope) &&
    CUSTOM_ROLE_PERMISSION_CATALOG[code]?.customRoleAssignable &&
    CUSTOM_ROLE_PERMISSION_CATALOG[code]?.allowedScopes.includes(scope),
  );
}

export function customRolePermissionCodes(
  scope: CustomRoleScope,
): WorkflowActionCode[] {
  if (!isCustomRoleScope(scope)) return [];
  return (
    Object.entries(CUSTOM_ROLE_PERMISSION_CATALOG) as [
      WorkflowActionCode,
      CustomRolePermissionMetadata,
    ][]
  )
    .filter(([, metadata]) => metadata.allowedScopes.includes(scope))
    .map(([code]) => code);
}
