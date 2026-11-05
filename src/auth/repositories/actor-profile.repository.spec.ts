import { RequestContext } from '../../common/context/request-context';
import { ActorProfileRepository } from './actor-profile.repository';

describe('ActorProfileRepository acting-profile selection', () => {
  it('clears the previous current profile before selecting the requested eligible profile', async () => {
    const selected = {
      id: 'marketing-profile',
      roleId: 'marketing-role',
      memberId: 'member-id',
      clientContactId: null,
      label: 'Marketing Lead - CCR',
      isDefault: true,
      isActive: true,
      role: {
        customCode: 'marketing_lead_ccr',
        customScope: 'company',
        systemRole: null,
      },
    };
    const db = {
      actorProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: selected.id })
          .mockResolvedValueOnce(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(selected),
      },
    };
    const repository = new ActorProfileRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);

    const result = await RequestContext.run(
      { requestId: 'request-id', tenantId: 'tenant-id' },
      () => repository.setDefault(selected.id, 'user-id'),
    );

    expect(db.actorProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-id',
          userId: 'user-id',
          isDefault: true,
          id: { not: selected.id },
        },
        data: { isDefault: false },
      }),
    );
    expect(result).toMatchObject({ id: selected.id, isDefault: true });
  });

  it('refuses to activate Staff while a non-Staff custom profile is active', async () => {
    const db = {
      actorProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'staff-profile' })
          .mockResolvedValueOnce({ id: 'custom-profile' })
          .mockResolvedValueOnce({ role: { customCode: 'staff' } }),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const repository = new ActorProfileRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run(
        { requestId: 'request-id', tenantId: 'tenant-id' },
        () => repository.setDefault('staff-profile', 'user-id'),
      ),
    ).resolves.toBeNull();
    expect(db.actorProfile.update).not.toHaveBeenCalled();
  });

  it('lists only switchable non-Staff profiles when one exists', async () => {
    const db = {
      actorProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'staff-profile',
            role: { customCode: 'staff', isSystemRole: false },
          },
          {
            id: 'custom-profile',
            role: { customCode: 'marketing_lead_ccr', isSystemRole: false },
          },
        ]),
      },
    };
    const repository = new ActorProfileRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run({ tenantId: 'tenant-id' } as never, () =>
        repository.findForUser('user-id'),
      ),
    ).resolves.toEqual([expect.objectContaining({ id: 'custom-profile' })]);
  });
});
