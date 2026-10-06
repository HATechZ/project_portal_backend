import { CUSTOM_ROLE_SCOPES, isCustomRoleScope } from './custom-role-policy';

describe('final custom-role scope policy', () => {
  it('exposes exactly the six system-defined scopes', () => {
    expect(isCustomRoleScope('global')).toBe(false);
    expect(CUSTOM_ROLE_SCOPES).toEqual([
      'company',
      'division',
      'team',
      'member',
      'client',
      'client_contact',
    ]);
  });

  it('does not embed permission compatibility in a role-name policy', () => {
    expect(isCustomRoleScope('Marketing')).toBe(false);
    expect(isCustomRoleScope('client_owner')).toBe(false);
  });
});
