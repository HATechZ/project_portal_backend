import { STARTER_ROLES, isStarterRoleCode, starterRole } from './starter-role-definition';

describe('starter role definition', () => {
  it('defines only the approved tenant-owned starter bundles', () => {
    expect(STARTER_ROLES.map(({ code, scope }) => [code, scope])).toEqual([
      ['staff', 'member'],
      ['supervisor', 'team'],
      ['manager', 'division'],
    ]);
    expect(starterRole('manager')?.permissions).toContain('ASSIGN_WORK_REQUEST_TEAM');
    expect(starterRole('manager')?.permissions).not.toContain('ASSIGN_WORK_REQUEST_DIVISION');
  });

  it('reserves only exact starter codes', () => {
    expect(isStarterRoleCode('staff')).toBe(true);
    expect(isStarterRoleCode('staff_2')).toBe(false);
  });
});
