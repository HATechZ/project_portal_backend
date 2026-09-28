import { RequestContext } from '../../common/context/request-context';
import { RoleAssignmentRepository } from './role-assignment.repository';

describe('RoleAssignmentRepository', () => {
  const teamRole = {
    isSystemRole: false,
    name: 'Team custom role',
    customScope: 'team',
    workflowActionRolePermissionsByRoleId: [{ id: 'permission-id' }],
  };

  function subject(overrides: Record<string, unknown> = {}) {
    const db = {
      role: { findFirstOrThrow: jest.fn().mockResolvedValue(teamRole) },
      member: { findFirst: jest.fn().mockResolvedValue({ id: 'member-id' }) },
      team: { findFirst: jest.fn().mockResolvedValue({ id: 'team-id' }) },
      teamMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-id' }),
      },
      ...overrides,
    };
    return new RoleAssignmentRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work(db as never),
    } as never);
  }

  async function assign(repository: RoleAssignmentRepository, teamId?: string) {
    return RequestContext.run(
      { requestId: 'request-id', tenantId: 'tenant-id' },
      () =>
        repository.ensureAssignment('user-id', 'role-id', 'admin-id', teamId),
    );
  }

  it('requires an exact Team for a TEAM-scoped custom-role grant', async () => {
    await expect(assign(subject())).rejects.toMatchObject({
      message: 'A Team is required for a TEAM-scoped custom role.',
    });
  });

  it('rejects an inactive or cross-tenant Team for a TEAM-scoped custom-role grant', async () => {
    const repository = subject({
      team: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(assign(repository, 'other-tenant-team')).rejects.toMatchObject(
      {
        message: 'The selected Team is unavailable.',
      },
    );
  });

  it('requires the target Member to be actively assigned to the exact Team', async () => {
    const repository = subject({
      teamMember: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(assign(repository, 'team-id')).rejects.toMatchObject({
      message: 'The selected Member is not active on the selected Team.',
    });
  });

  it('rejects teamId for COMPANY, DIVISION, and fixed-role grants', async () => {
    for (const role of [
      { ...teamRole, customScope: 'company' },
      { ...teamRole, customScope: 'division' },
      {
        isSystemRole: true,
        name: 'Fixed role',
        customScope: null,
        workflowActionRolePermissionsByRoleId: [],
      },
    ]) {
      const repository = subject({
        role: { findFirstOrThrow: jest.fn().mockResolvedValue(role) },
      });
      await expect(assign(repository, 'team-id')).rejects.toMatchObject({
        message: 'A Team can only be supplied for a TEAM-scoped custom role.',
      });
    }
  });

  it('links a later role assignment to an active Member when one exists', async () => {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-id' }]),
      role: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          isSystemRole: true,
          name: 'Division Member',
          customScope: null,
          workflowActionRolePermissionsByRoleId: [],
        }),
      },
      member: { findFirst: jest.fn().mockResolvedValue({ id: 'member-id' }) },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-id' }),
      },
      userRole: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'assignment-id', teamId: null }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'assignment-id' }),
      },
      actorProfile: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        updateMany: jest.fn(),
        create: jest.fn((input: { data: { memberId?: string } }) => {
          expect(input.data.memberId).toBe('member-id');
          return Promise.resolve({ id: 'profile-id' });
        }),
      },
    };
    const repository = new RoleAssignmentRepository({
      execute: async (work: (transaction: never) => Promise<{ id: string }>) =>
        work(db as never),
    } as never);

    await RequestContext.run(
      { requestId: 'request-id', tenantId: 'tenant-id' },
      () => repository.ensureAssignment('user-id', 'role-id', 'admin-id'),
    );

    expect(db.member.findFirst).toHaveBeenCalled();
    expect(db.actorProfile.create).toHaveBeenCalled();
  });
});
