import { RequestContext } from '../../common/context/request-context';
import { MemberExistingUserOnboardingRepository } from './member-existing-user-onboarding.repository';

const tenantId = 'tenant-id';
const input = {
  userId: 'user-id',
  actorProfileId: 'actor-profile-id',
  divisionId: 'division-id',
  designationId: 'designation-id',
  phone: '+1-555-0100',
};
const member = {
  id: 'member-id',
  userId: input.userId,
  companyId: 'company-id',
  divisionId: input.divisionId,
  designationId: input.designationId,
  designation: { name: 'Coordinator' },
  company: { isActive: true },
  name: 'Existing User',
  email: 'existing@example.test',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function database(existingMember: typeof member | null = null) {
  return {
    $queryRaw: jest.fn(),
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: input.userId,
        fullName: ' Existing User ',
        email: 'EXISTING@EXAMPLE.TEST ',
      }),
      update: jest.fn(),
    },
    company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-id' }) },
    actorProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: input.actorProfileId, memberId: null }),
      update: jest.fn(),
    },
    member: {
      findFirst: jest.fn().mockResolvedValue(existingMember),
      create: jest.fn().mockResolvedValue(member),
    },
    division: {
      findFirst: jest.fn().mockResolvedValue({ id: input.divisionId }),
    },
    designation: {
      findFirst: jest.fn().mockResolvedValue({ id: input.designationId }),
    },
  };
}

describe('MemberExistingUserOnboardingRepository', () => {
  it('creates one active Member for the existing User and links the existing ActorProfile', async () => {
    const db = database();
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).resolves.toEqual(member);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { phone: input.phone } }),
    );
    expect(db.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: input.userId,
          name: 'Existing User',
          email: 'existing@example.test',
          isActive: true,
        }),
      }),
    );
    expect(db.actorProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.actorProfileId, tenantId },
        data: { memberId: member.id },
      }),
    );
    expect(db.user).not.toHaveProperty('create');
  });

  it('returns the existing relationship for an idempotent retry', async () => {
    const db = database(member);
    db.actorProfile.findFirst.mockResolvedValue({
      id: input.actorProfileId,
      memberId: member.id,
    });
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).resolves.toEqual(member);

    expect(db.member.create).not.toHaveBeenCalled();
    expect(db.actorProfile.update).not.toHaveBeenCalled();
  });

  it('rejects a User that already has a Member linked to another ActorProfile', async () => {
    const db = database(member);
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('This User already has a Member');

    expect(db.member.create).not.toHaveBeenCalled();
  });

  it('does not treat an inactive existing Member as an idempotent success', async () => {
    const db = database({ ...member, isActive: false });
    db.actorProfile.findFirst.mockResolvedValue({
      id: input.actorProfileId,
      memberId: member.id,
    });
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('This User already has a Member');

    expect(db.member.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive or foreign User before any Member mutation', async () => {
    const db = database();
    db.user.findFirst.mockResolvedValue(null);
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('User was not found');

    expect(db.member.create).not.toHaveBeenCalled();
    expect(db.actorProfile.update).not.toHaveBeenCalled();
  });

  it('requires an active internal ActorProfile with an active matching grant', async () => {
    const db = database();
    db.actorProfile.findFirst.mockResolvedValue(null);
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('Eligible ActorProfile was not found');

    expect(db.actorProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          userId: input.userId,
          isActive: true,
          clientContactId: null,
          role: expect.objectContaining({ isActive: true }),
        }),
      }),
    );
    expect(db.member.create).not.toHaveBeenCalled();
  });

  it('rejects an ActorProfile already linked to another Member', async () => {
    const db = database();
    db.actorProfile.findFirst.mockResolvedValue({
      id: input.actorProfileId,
      memberId: 'another-member-id',
    });
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('ActorProfile is already linked to a different Member');

    expect(db.member.create).not.toHaveBeenCalled();
  });

  it('requires an active scoped Company and active same-Tenant Division', async () => {
    const noCompany = database();
    noCompany.company.findFirst.mockResolvedValue(null);
    const noCompanyRepository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(noCompany as never),
    } as never);
    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        noCompanyRepository.createAndLink(input),
      ),
    ).rejects.toThrow('Active Company was not found');

    const noDivision = database();
    noDivision.division.findFirst.mockResolvedValue(null);
    const noDivisionRepository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(noDivision as never),
    } as never);
    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        noDivisionRepository.createAndLink(input),
      ),
    ).rejects.toThrow('Active Division was not found');

    expect(noDivision.division.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          companyId: 'company-id',
          isActive: true,
        }),
      }),
    );
  });

  it('requires a same-Tenant same-Company Designation', async () => {
    const db = database();
    db.designation.findFirst.mockResolvedValue(null);
    const repository = new MemberExistingUserOnboardingRepository({
      execute: async (work: (transaction: never) => Promise<typeof member>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository.createAndLink(input),
      ),
    ).rejects.toThrow('Designation was not found');

    expect(db.designation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, companyId: 'company-id' }),
      }),
    );
    expect(db.member.create).not.toHaveBeenCalled();
  });
});
