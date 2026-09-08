import { RequestContext } from '../../common/context/request-context';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { AuthSessionRepository } from './auth-session.repository';

describe('AuthSessionRepository', () => {
  interface QueryArgs {
    where: Record<string, unknown>;
    data?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }

  const tenantId = '10000000-0000-4000-8000-000000000001';
  const db = {
    user: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    authSessionConsumedRefreshToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  let capturedUpdate: QueryArgs | undefined;
  let capturedCreate: { data: Record<string, unknown> } | undefined;
  let capturedFind: QueryArgs | undefined;
  const unitOfWork = {
    execute: jest.fn((work: (executor: typeof db) => unknown) => work(db)),
  };
  const repository = () =>
    new AuthSessionRepository(unitOfWork as unknown as UnitOfWorkService);

  beforeEach(() => {
    jest.clearAllMocks();
    capturedUpdate = undefined;
    capturedCreate = undefined;
    capturedFind = undefined;
  });

  it('stamps login and creates its session in one unit of work', async () => {
    const user = { id: 'user-1' };
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUniqueOrThrow.mockResolvedValue(user);
    db.authSession.create.mockResolvedValue({ id: 'session-1' });
    const session = {
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'refresh-hash',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      absoluteExpiresAt: new Date('2030-01-02T00:00:00.000Z'),
    };

    await expect(
      RequestContext.run({ requestId: 'login', tenantId }, () =>
        repository().recordLoginAndCreateSession(
          'user-1',
          session,
          'verified-hash',
        ),
      ),
    ).resolves.toBe(user);

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'user-1',
          tenantId,
          isActive: true,
          passwordHash: 'verified-hash',
        },
      }),
    );
    expect(db.authSession.create).toHaveBeenCalledWith({ data: session });
  });

  it('rotates within the current Tenant and records the consumed token', async () => {
    db.authSession.updateMany.mockImplementation((args: QueryArgs) => {
      capturedUpdate = args;
      return Promise.resolve({ count: 1 });
    });
    db.authSessionConsumedRefreshToken.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => {
        capturedCreate = args;
        return Promise.resolve({});
      },
    );

    const result = await RequestContext.run(
      { requestId: 'rotate', tenantId },
      () =>
        repository().rotateSession('session-1', 'old-hash', {
          refreshTokenHash: 'new-hash',
          previousRefreshTokenHash: 'old-hash',
          expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        }),
    );

    expect(result).toBe(true);
    expect(capturedUpdate?.where.tenantId).toBe(tenantId);
    expect(capturedUpdate?.where.id).toBe('session-1');
    expect(capturedUpdate?.data?.tenantId).toBe(tenantId);
    expect(capturedCreate?.data.tenantId).toBe(tenantId);
    expect(capturedCreate?.data.sessionId).toBe('session-1');
    expect(capturedCreate?.data.tokenHash).toBe('old-hash');
  });

  it('does not record a consumed token when rotation loses its race', async () => {
    db.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      RequestContext.run({ requestId: 'rotate', tenantId }, () =>
        repository().rotateSession('session-1', 'old-hash', {
          refreshTokenHash: 'new-hash',
          expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        }),
      ),
    ).resolves.toBe(false);
    expect(db.authSessionConsumedRefreshToken.create).not.toHaveBeenCalled();
  });

  it('finds replayed hashes in both current-session history stores', async () => {
    db.authSession.findFirst.mockResolvedValueOnce(null);
    db.authSessionConsumedRefreshToken.findFirst.mockResolvedValueOnce({
      sessionId: 'session-1',
    });

    await expect(
      repository().findSessionByConsumedTokenHash('consumed-hash'),
    ).resolves.toEqual({ id: 'session-1' });
    expect(db.authSessionConsumedRefreshToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: 'consumed-hash',
        session: { revokedAt: null },
      },
      select: { sessionId: true },
    });
  });

  it('revokes logout sessions and includes expiry in activity checks', async () => {
    db.authSession.updateMany.mockImplementation((args: QueryArgs) => {
      capturedUpdate = args;
      return Promise.resolve({ count: 1 });
    });
    db.authSession.findFirst.mockImplementation((args: QueryArgs) => {
      capturedFind = args;
      return Promise.resolve(null);
    });

    await repository().revokeSession('session-1');
    await expect(
      repository().isSessionActive('session-1', 'user-1'),
    ).resolves.toBe(false);

    expect(capturedUpdate?.where).toEqual({
      id: 'session-1',
      revokedAt: null,
    });
    expect(capturedUpdate?.data?.revokedAt).toBeInstanceOf(Date);
    expect(capturedFind?.where.id).toBe('session-1');
    expect(capturedFind?.where.userId).toBe('user-1');
    expect(capturedFind?.where.revokedAt).toBeNull();
    expect(
      (capturedFind?.where.expiresAt as { gt: unknown }).gt,
    ).toBeInstanceOf(Date);
    expect(
      (capturedFind?.where.absoluteExpiresAt as { gt: unknown }).gt,
    ).toBeInstanceOf(Date);
    expect(capturedFind?.select).toEqual({ id: true });
  });
});
