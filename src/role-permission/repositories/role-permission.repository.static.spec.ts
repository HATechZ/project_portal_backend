import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('RolePermissionRepository custom-role scope replacement', () => {
  const source = readFileSync(
    resolve('src/role-permission/repositories/role-permission.repository.ts'),
    'utf8',
  );

  it('keeps a custom-role scope update tenant-constrained', () => {
    expect(source).toContain(
      'where: { id: roleId, tenantId, isSystemRole: false }',
    );
  });

  it('retains fixed-role reads as global-or-current-tenant only', () => {
    expect(source).toContain('OR: [{ isSystemRole: true }, { tenantId }]');
  });
});
