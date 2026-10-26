import { MemberService } from './member.service';

describe('MemberService', () => {
  it('creates a member through the tenant company and hashes no plaintext password', async () => {
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue({ id: 'company-1' }),
      findDesignation: jest.fn().mockResolvedValue({ id: 'designation-1' }),
    };
    const onboarding = {
      createWithAccess: jest.fn().mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        companyId: 'company-1',
        divisionId: 'division-1',
        designationId: 'designation-1',
        designation: { name: 'Engineer' },
        name: 'Member',
        email: 'member@example.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const passwordHasher = { hash: jest.fn().mockResolvedValue('hash') };
    const service = new MemberService(
      repository as never,
      {} as never,
      {} as never,
      onboarding as never,
      {} as never,
      passwordHasher as never,
      {} as never,
    );
    await service.create(
      {
        name: 'Member',
        email: 'member@example.test',
        password: 'secret123',
        divisionId: 'division-1',
        designationId: 'designation-1',
      },
      'creator-user-id',
    );
    expect(passwordHasher.hash).toHaveBeenCalledWith('secret123');
    expect(onboarding.createWithAccess).toHaveBeenCalledWith(
      'company-1',
      expect.not.objectContaining({ password: 'secret123' }),
      'creator-user-id',
    );
  });

  it('removes through the lifecycle repository without a system-role shortcut', async () => {
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue({ id: 'company-1' }),
    };
    const removal = { remove: jest.fn() };
    const service = new MemberService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      removal as never,
    );
    await service.delete('member-1');
    expect(removal.remove).toHaveBeenCalledWith('member-1', 'company-1');
  });
});
