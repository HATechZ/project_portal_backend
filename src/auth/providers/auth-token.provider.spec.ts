import { createHash } from 'node:crypto';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';

jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { AuthTokenProvider } from './auth-token.provider';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

describe('AuthTokenProvider refresh rotation', () => {
  it('rotates the freshly issued token and rejects its later reuse', async () => {
    const issuedUser = { id: userId };
    const session = {
      id: sessionId,
      userId,
      tenantId,
      refreshTokenHash: '',
      previousRefreshTokenHash: null as string | null,
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000),
      revokedAt: null as Date | null,
    };
    const consumedHashes = new Set<string>();
    type SessionHashes = {
      refreshTokenHash: string;
      previousRefreshTokenHash: string;
    };
    const repository = {
      recordLoginAndCreateSession: jest.fn(
        (_id: string, input: SessionHashes) => {
          session.refreshTokenHash = input.refreshTokenHash;
          return Promise.resolve(issuedUser);
        },
      ),
      findValidSessionByTokenHash: jest.fn((tokenHash: string) =>
        Promise.resolve(
          tokenHash === session.refreshTokenHash &&
            session.revokedAt === null &&
            session.expiresAt > new Date() &&
            session.absoluteExpiresAt > new Date()
            ? session
            : null,
        ),
      ),
      findSessionByConsumedTokenHash: jest.fn((tokenHash: string) =>
        Promise.resolve(
          consumedHashes.has(tokenHash) ? { id: session.id } : null,
        ),
      ),
      findActiveUser: jest.fn(() => Promise.resolve(issuedUser)),
      rotateSession: jest.fn(
        (_id: string, currentHash: string, input: SessionHashes) => {
          if (currentHash !== session.refreshTokenHash) {
            return Promise.resolve(false);
          }
          session.refreshTokenHash = input.refreshTokenHash;
          session.previousRefreshTokenHash = input.previousRefreshTokenHash;
          consumedHashes.add(currentHash);
          return Promise.resolve(true);
        },
      ),
      revokeSession: jest.fn(() => {
        session.revokedAt = new Date();
        return Promise.resolve();
      }),
    };
    const provider = new AuthTokenProvider(
      { signAsync: jest.fn(() => Promise.resolve('access-token')) } as never,
      {
        get: jest.fn((key: string) =>
          key === 'jwt.refreshTtlSeconds'
            ? 60
            : key === 'jwt.sessionAbsoluteTtlSeconds'
              ? 120
              : 900,
        ),
      } as never,
      repository as never,
    );
    const request = { ip: '127.0.0.1', get: jest.fn() } as never;

    const login = await provider.issueLogin(
      userId,
      tenantId,
      request,
      'password-hash',
    );
    const originalRefreshToken = login.tokens.refreshToken;

    expect(session.refreshTokenHash).toBe(hash(originalRefreshToken));
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.absoluteExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(session.revokedAt).toBeNull();
    expect(consumedHashes.size).toBe(0);

    const refreshed = await provider.rotate(originalRefreshToken, request);

    expect(repository.findValidSessionByTokenHash).toHaveBeenCalledWith(
      hash(originalRefreshToken),
    );
    expect(refreshed.refreshToken).not.toBe(originalRefreshToken);
    expect(session.previousRefreshTokenHash).toBe(hash(originalRefreshToken));
    expect(consumedHashes.has(hash(originalRefreshToken))).toBe(true);
    expect(session.revokedAt).toBeNull();

    await expect(
      provider.rotate(originalRefreshToken, request),
    ).rejects.toEqual(
      new AppException({
        code: AppErrorCode.AuthRefreshInvalid,
        status: 401,
        message: 'Your session is no longer valid. Sign in again to continue.',
      }),
    );
    expect(repository.revokeSession).toHaveBeenCalledWith(sessionId);
  });
});
