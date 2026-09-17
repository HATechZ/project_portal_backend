import { HttpStatus } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { MemberRemovalRepository } from './member-removal.repository';

const tenantId = 'tenant-id';
const userId = 'user-id';
const memberId = 'member-id';

function createDb() {
  return {
    member: {
      findFirst: jest.fn().mockResolvedValue({ id: memberId, userId }),
      update: jest
        .fn<Promise<unknown>, [Prisma.MemberUpdateArgs]>()
        .mockResolvedValue(undefined),
    },
    divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
    team: { findFirst: jest.fn().mockResolvedValue(null) },
    teamMember: {
      updateMany: jest
        .fn<Promise<{ count: number }>, [Prisma.TeamMemberUpdateManyArgs]>()
        .mockResolvedValue({ count: 1 }),
    },
    actorProfile: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'profile-id', roleId: 'role-id', userId },
        ])
        .mockResolvedValueOnce([]),
      updateMany: jest
        .fn<Promise<{ count: number }>, [Prisma.ActorProfileUpdateManyArgs]>()
        .mockResolvedValue({ count: 1 }),
    },
    userRole: {
      updateMany: jest
        .fn<Promise<{ count: number }>, [Prisma.UserRoleUpdateManyArgs]>()
        .mockResolvedValue({ count: 1 }),
    },
    authSession: {
      updateMany: jest
        .fn<Promise<{ count: number }>, [Prisma.AuthSessionUpdateManyArgs]>()
        .mockResolvedValue({ count: 1 }),
    },
    user: {
      update: jest
        .fn<Promise<unknown>, [Prisma.UserUpdateArgs]>()
        .mockResolvedValue(undefined),
    },
  };
}

describe('MemberRemovalRepository', () => {
  function repository(db: ReturnType<typeof createDb>) {
    return new MemberRemovalRepository({
      execute: async (work: (transaction: never) => Promise<void>) =>
        work(db as never),
    } as never);
  }

  it('ends active access while retaining historical rows', async () => {
    const db = createDb();
    await RequestContext.run({ requestId: 'request-id', tenantId }, () =>
      repository(db).remove(memberId, 'company-id'),
    );

    expect(db.teamMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId, memberId, leftAt: null } }),
    );
    expect(db.actorProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false, isDefault: false } }),
    );
    expect(
      db.userRole.updateMany.mock.calls[0]?.[0].data.revokedAt,
    ).toBeInstanceOf(Date);
    expect(
      db.authSession.updateMany.mock.calls[0]?.[0].data.revokedAt,
    ).toBeInstanceOf(Date);
    expect(db.member.update.mock.calls[0]?.[0].data.isActive).toBe(false);
    expect(db.user.update.mock.calls[0]?.[0].data.isActive).toBe(false);
  });

  it('keeps a User active when another valid identity remains', async () => {
    const db = createDb();
    db.actorProfile.findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: 'profile-id', roleId: 'role-id', userId }])
      .mockResolvedValueOnce([{ id: 'client-profile', roleId: 'client-role' }]);

    await RequestContext.run({ requestId: 'request-id', tenantId }, () =>
      repository(db).remove(memberId, 'company-id'),
    );

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.authSession.updateMany).toHaveBeenCalled();
  });

  it('removes an unassigned Member without requiring a UserRole or ActorProfile', async () => {
    const db = createDb();
    db.actorProfile.findMany
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await RequestContext.run({ requestId: 'request-id', tenantId }, () =>
      repository(db).remove(memberId, 'company-id'),
    );

    expect(db.userRole.updateMany).not.toHaveBeenCalled();
    expect(db.member.update).toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalled();
  });

  it('leaves all lifecycle rows untouched when active leadership blocks removal', async () => {
    const db = createDb();
    db.divisionLead.findFirst.mockResolvedValue({ id: 'lead-id' });

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        repository(db).remove(memberId, 'company-id'),
      ),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });

    expect(db.member.update).not.toHaveBeenCalled();
    expect(db.teamMember.updateMany).not.toHaveBeenCalled();
    expect(db.actorProfile.updateMany).not.toHaveBeenCalled();
  });
});
