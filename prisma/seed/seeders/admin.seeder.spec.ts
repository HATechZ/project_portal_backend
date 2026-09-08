import { hash } from 'bcryptjs';
import { ActorRoleCode } from '../../../src/generated/prisma/client';
import { ADMIN_IDS } from '../data/admin.data';
import { SeedContext } from '../types';
import { adminSeeder } from './admin.seeder';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));

describe('adminSeeder', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const admin = {
    tenantId,
    email: ' Admin@Example.com ',
    fullName: 'Initial Admin',
    password: 'not-observed-by-the-test',
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: { findUniqueOrThrow: jest.fn() },
    userRole: { upsert: jest.fn() },
    actorProfile: { upsert: jest.fn() },
  };
  const context = { prisma, admin } as unknown as SeedContext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(hash).mockResolvedValue('password-hash' as never);
    prisma.role.findUniqueOrThrow.mockResolvedValue({ id: 'role-1' });
    prisma.userRole.upsert.mockResolvedValue({});
    prisma.actorProfile.upsert.mockResolvedValue({});
  });

  it('is idempotent and preserves role-only ActorProfile behavior', async () => {
    const user = { id: ADMIN_IDS.user, tenantId };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user);
    prisma.user.create.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    await adminSeeder.run(context);
    await adminSeeder.run(context);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'admin@example.com' },
    });
    expect(prisma.role.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { code: ActorRoleCode.system_admin },
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.actorProfile.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId,
          userId: ADMIN_IDS.user,
          roleId: 'role-1',
          isDefault: true,
          isActive: true,
        }),
        update: expect.objectContaining({
          tenantId,
          userId: ADMIN_IDS.user,
          roleId: 'role-1',
          isDefault: true,
          isActive: true,
        }),
      }),
    );
  });

  it('fails safely when the global email belongs to another Tenant', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'other-user',
      tenantId: '20000000-0000-4000-8000-000000000002',
    });

    await expect(adminSeeder.run(context)).rejects.toThrow(
      'Initial administrator email belongs to a different Tenant',
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
    expect(prisma.actorProfile.upsert).not.toHaveBeenCalled();
  });

  it('never reassigns an existing same-Tenant User', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: ADMIN_IDS.user,
      tenantId,
    });
    prisma.user.update.mockResolvedValue({ id: ADMIN_IDS.user, tenantId });

    await adminSeeder.run(context);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'admin@example.com' },
        data: expect.not.objectContaining({ tenantId: expect.anything() }),
      }),
    );
  });
});
