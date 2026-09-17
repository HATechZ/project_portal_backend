import { RequestContext } from '../../common/context/request-context';
import { MemberOnboardingRepository } from './member-onboarding.repository';

describe('MemberOnboardingRepository', () => {
  const tenantId = 'tenant-id';
  const member = { id: 'member-id', userId: 'user-id' };

  it('creates only the linked User and Member, without role access or Team membership', async () => {
    const db = {
      user: { create: jest.fn().mockResolvedValue({ id: 'user-id' }) },
      member: { create: jest.fn().mockResolvedValue(member) },
      role: { findFirst: jest.fn() },
      userRole: { create: jest.fn() },
      actorProfile: { create: jest.fn() },
      teamMember: { create: jest.fn() },
    };
    const repository = new MemberOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createWithAccess('company-id', {
          name: 'Jane Member',
          email: 'jane@example.com',
          passwordHash: 'hashed-password',
          divisionId: 'division-id',
          designation: 'Engineer',
          phone: '+1-555-0100',
        }),
      ),
    ).resolves.toEqual(member);

    expect(db.userRole.create).not.toHaveBeenCalled();
    expect(db.actorProfile.create).not.toHaveBeenCalled();
    expect(db.teamMember.create).not.toHaveBeenCalled();
    expect(db.role.findFirst).not.toHaveBeenCalled();
  });
});
