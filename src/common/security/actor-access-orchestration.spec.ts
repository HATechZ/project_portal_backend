import { ensureUserRoleAndRoleOnlyProfile } from './actor-access-orchestration';

function dbWithExistingState() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    role: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Division Lead' }),
    },
    userRole: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-role-1' }),
      create: jest.fn(),
    },
    actorProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'default-profile' })
        .mockResolvedValueOnce({ id: 'actor-profile-1' }),
      updateMany: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'actor-profile-1' }),
      create: jest.fn(),
    },
  };
}

describe('actor access orchestration', () => {
  it('reuses existing active UserRole and role-only ActorProfile', async () => {
    const db = dbWithExistingState();
    await expect(
      ensureUserRoleAndRoleOnlyProfile(db as never, {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        assignedByUserId: 'admin-1',
      }),
    ).resolves.toEqual({
      assignmentId: 'user-role-1',
      actorProfileId: 'actor-profile-1',
    });
    expect(db.userRole.create).not.toHaveBeenCalled();
    expect(db.actorProfile.create).not.toHaveBeenCalled();
  });

  it('creates missing UserRole and ActorProfile once', async () => {
    const db = dbWithExistingState();
    db.userRole.findFirst.mockResolvedValueOnce(null);
    db.userRole.create.mockResolvedValueOnce({ id: 'user-role-new' });
    db.actorProfile.findFirst.mockReset();
    db.actorProfile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    db.actorProfile.create.mockResolvedValueOnce({ id: 'actor-profile-new' });

    await expect(
      ensureUserRoleAndRoleOnlyProfile(db as never, {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        assignedByUserId: 'admin-1',
      }),
    ).resolves.toEqual({
      assignmentId: 'user-role-new',
      actorProfileId: 'actor-profile-new',
    });
    expect(db.userRole.create).toHaveBeenCalledTimes(1);
    expect(db.actorProfile.create).toHaveBeenCalledTimes(1);
  });

  it('reuses an already member-linked ActorProfile for repeat business assignment', async () => {
    const db = dbWithExistingState();
    db.actorProfile.findFirst.mockReset();
    db.actorProfile.findFirst
      .mockResolvedValueOnce({ id: 'default-profile' })
      .mockResolvedValueOnce({ id: 'member-linked-profile' });

    await expect(
      ensureUserRoleAndRoleOnlyProfile(db as never, {
        tenantId: 'tenant-1',
        userId: 'user-1',
        roleId: 'role-1',
        assignedByUserId: 'admin-1',
        memberId: 'member-1',
      }),
    ).resolves.toEqual({
      assignmentId: 'user-role-1',
      actorProfileId: 'member-linked-profile',
    });
    expect(db.actorProfile.create).not.toHaveBeenCalled();
  });
});
