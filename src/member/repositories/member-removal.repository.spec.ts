import { HttpStatus } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { MemberRemovalRepository } from './member-removal.repository';

const tenantId = 'tenant-id';
const userId = 'user-id';
const memberId = 'member-id';

function createDb() {
  return {
    member: {
      findFirst: jest.fn().mockResolvedValue({ id: memberId, userId }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
    team: { findFirst: jest.fn().mockResolvedValue(null) },
    teamMember: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    actorProfile: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'profile-id', roleId: 'role-id', userId }])
        .mockResolvedValueOnce([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userRole: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    user: { update: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('MemberRemovalRepository', () => {
  function repository(db: ReturnType<typeof createDb>) {
    return new MemberRemovalRepository({
      execute: async (work: (transaction: never) => Promise<void>) => work(db as never),
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
    expect(db.userRole.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(db.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(db.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
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
