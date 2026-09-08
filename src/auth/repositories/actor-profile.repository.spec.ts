import { RequestContext } from '../../common/context/request-context';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ActorProfileRepository } from './actor-profile.repository';

describe('ActorProfileRepository', () => {
  const db = {
    actorProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const unitOfWork = {
    execute: jest.fn((work: (executor: typeof db) => unknown) => work(db)),
  };
  const repository = () =>
    new ActorProfileRepository(unitOfWork as unknown as UnitOfWorkService);

  beforeEach(() => jest.clearAllMocks());

  it('queries profiles by the authenticated User only', async () => {
    db.actorProfile.findMany.mockResolvedValue([]);

    await repository().findForUser('user-1');

    expect(db.actorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('switches the default atomically only for an eligible active role grant', async () => {
    db.actorProfile.findFirst.mockResolvedValue({ id: 'actor-2' });
    db.actorProfile.updateMany.mockResolvedValue({ count: 1 });
    db.actorProfile.update.mockResolvedValue({ id: 'actor-2' });

    await RequestContext.run(
      { requestId: 'activate', tenantId: 'tenant-1' },
      () => repository().setDefault('actor-2', 'user-1'),
    );

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(db.actorProfile.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'actor-2',
        tenantId: 'tenant-1',
        userId: 'user-1',
        isActive: true,
        role: {
          userRolesByRoleId: {
            some: {
              tenantId: 'tenant-1',
              userId: 'user-1',
              revokedAt: null,
            },
          },
        },
      },
      select: { id: true },
    });
    expect(db.actorProfile.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        isDefault: true,
        id: { not: 'actor-2' },
      },
      data: { isDefault: false },
    });
  });

  it('does not modify defaults for an ineligible profile', async () => {
    db.actorProfile.findFirst.mockResolvedValue(null);

    await expect(
      RequestContext.run({ requestId: 'activate', tenantId: 'tenant-1' }, () =>
        repository().setDefault('actor-other', 'user-1'),
      ),
    ).resolves.toBeNull();
    expect(db.actorProfile.updateMany).not.toHaveBeenCalled();
    expect(db.actorProfile.update).not.toHaveBeenCalled();
  });
});
