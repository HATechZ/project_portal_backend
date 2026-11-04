import { RequestContext } from '../../common/context/request-context';
import { RoleOptionsRepository } from './role-options.repository';

describe('RoleOptionsRepository Member custom-role selector', () => {
  it('excludes system roles, scopes the query to the Tenant, and requires an active linked Member', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-id',
          membersByUserId: [{ id: 'member-id' }],
        }),
      },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      role: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new RoleOptionsRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);

    await RequestContext.run(
      { requestId: 'request-id', tenantId: 'tenant-id' },
      () => repository.findForUser('user-id'),
    );

    expect(db.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-id',
          isSystemRole: false,
          isActive: true,
          customScope: { not: null },
        }),
      }),
    );
  });

  it('returns no assignment options for a User without an active linked Member', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-id',
          membersByUserId: [],
        }),
      },
      userRole: { findMany: jest.fn() },
      role: { findMany: jest.fn() },
    };
    const repository = new RoleOptionsRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);

    await expect(
      RequestContext.run(
        { requestId: 'request-id', tenantId: 'tenant-id' },
        () => repository.findForUser('user-id'),
      ),
    ).resolves.toEqual([]);
    expect(db.role.findMany).not.toHaveBeenCalled();
  });
});
