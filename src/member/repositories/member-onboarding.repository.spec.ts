import { RequestContext } from '../../common/context/request-context';
import { MemberOnboardingRepository } from './member-onboarding.repository';

describe('MemberOnboardingRepository', () => {
  const tenantId = 'tenant-id';
  const member = { id: 'member-id', userId: 'user-id' };

  it('atomically creates the linked User, Member, and Staff access without Team membership', async () => {
    const db = {
      $queryRaw: jest.fn(),
      user: {
        create: jest.fn().mockResolvedValue({ id: 'user-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-id' }),
      },
      member: { create: jest.fn().mockResolvedValue(member) },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-role-id' }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ name: 'Staff' }),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'grant-id' }),
      },
      actorProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'profile-id' }),
      },
      teamMember: { create: jest.fn() },
    };
    const repository = new MemberOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createWithAccess(
          'company-id',
          {
            name: 'Jane Member',
            email: 'jane@example.com',
            passwordHash: 'hashed-password',
            divisionId: 'division-id',
            designationId: 'designation-id',
            phone: '+1-555-0100',
          },
          'creator-user-id',
        ),
      ),
    ).resolves.toEqual(member);

    expect(db.userRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roleId: 'staff-role-id',
          assignedByUserId: 'creator-user-id',
        }),
      }),
    );
    expect(db.actorProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberId: 'member-id' }),
      }),
    );
    expect(db.teamMember.create).not.toHaveBeenCalled();
    expect(db.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customCode: 'staff' }),
      }),
    );
  });
});
