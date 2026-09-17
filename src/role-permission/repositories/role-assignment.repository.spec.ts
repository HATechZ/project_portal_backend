import { RequestContext } from '../../common/context/request-context';
import { RoleAssignmentRepository } from './role-assignment.repository';

describe('RoleAssignmentRepository', () => {
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
        findFirst: jest.fn().mockResolvedValue({ id: 'assignment-id' }),
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
