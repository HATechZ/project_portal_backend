import { RequestContext } from '../../common/context/request-context';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { RoleAssignmentRepository } from './role-assignment.repository';

describe('RoleAssignmentRepository', () => {
  let createdProfile: Record<string, unknown> | undefined;
  const db = {
    $queryRaw: jest.fn(),
    user: { findUniqueOrThrow: jest.fn() },
    role: { findUniqueOrThrow: jest.fn() },
    userRole: { findFirst: jest.fn(), create: jest.fn() },
    actorProfile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const uow = { execute: (work: (client: typeof db) => unknown) => work(db) };
  const repo = new RoleAssignmentRepository(
    uow as unknown as UnitOfWorkService,
  );
  const run = () =>
    RequestContext.run({ requestId: 'test', tenantId: 'tenant' }, () =>
      repo.ensureAssignment('user', 'role', 'admin'),
    );
  beforeEach(() => {
    jest.resetAllMocks();
    createdProfile = undefined;
    db.actorProfile.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => {
        createdProfile = args.data;
        return Promise.resolve();
      },
    );
    db.role.findUniqueOrThrow.mockResolvedValue({ name: 'Member' });
    db.userRole.create.mockResolvedValue({ id: 'grant' });
  });
  it('creates the first role-only default in the grant transaction', async () => {
    await run();
    expect(createdProfile).toEqual(
      expect.objectContaining({
        userId: 'user',
        roleId: 'role',
        isDefault: true,
        isActive: true,
      }),
    );
    expect(createdProfile).not.toHaveProperty('memberId');
    expect(createdProfile).not.toHaveProperty('clientContactId');
  });
  it('reuses the grant and profile without changing an eligible default', async () => {
    db.userRole.findFirst.mockResolvedValue({ id: 'grant' });
    db.actorProfile.findFirst
      .mockResolvedValueOnce({ id: 'default' })
      .mockResolvedValueOnce({ id: 'profile' });
    await expect(run()).resolves.toEqual({ id: 'grant' });
    expect(db.userRole.create).not.toHaveBeenCalled();
    expect(db.actorProfile.create).not.toHaveBeenCalled();
    expect(db.actorProfile.updateMany).not.toHaveBeenCalled();
    expect(db.actorProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile', tenantId: 'tenant' },
      data: { isActive: true },
    });
  });
});
