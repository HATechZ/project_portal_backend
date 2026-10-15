import { CustomRoleRepository } from './custom-role.repository';

describe('CustomRoleRepository reserved starter codes', () => {
  it.each(['staff', 'supervisor', 'manager'])(
    'generates a collision-safe custom code for the reserved %s display name',
    async (name) => {
      const repository = new CustomRoleRepository({} as never);
      const nextCode = (
        repository as unknown as {
          nextCode: (
            db: unknown,
            tenantId: string,
            roleName: string,
          ) => Promise<string>;
        }
      ).nextCode;
      await expect(
        nextCode(
          { role: { findMany: jest.fn().mockResolvedValue([]) } },
          'tenant-a',
          name,
        ),
      ).resolves.toBe(`${name}_2`);
    },
  );
});
