import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import { SessionUser } from '../../common/security/session.types';
import { AppConfiguration } from '../../config/configuration';
import { AuthSessionRepository } from '../repositories';
jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));
import { AuthTokenProvider } from './auth-token.provider';

describe('AuthTokenProvider', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const request = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest'),
  } as unknown as Request;
  const user = { id: 'user-1', isActive: true } as SessionUser;
  const repository = {
    recordLoginAndCreateSession: jest.fn(),
    findValidSessionByTokenHash: jest.fn(),
    findSessionByConsumedTokenHash: jest.fn(),
    findActiveUser: jest.fn(),
    rotateSession: jest.fn(),
    revokeSession: jest.fn(),
    isSessionActive: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const settings: Record<string, unknown> = {
    'jwt.refreshTtlSeconds': 3600,
    'jwt.sessionAbsoluteTtlSeconds': 7200,
    'jwt.accessTtlSeconds': 900,
    'jwt.secret': 'test-secret',
    'jwt.issuer': 'test-issuer',
    'jwt.audience': 'test-audience',
  };
  const config = { get: jest.fn((key: string) => settings[key]) };

  const provider = () =>
    new AuthTokenProvider(
      jwtService as unknown as JwtService,
      config as unknown as ConfigService<AppConfiguration, true>,
      repository as unknown as AuthSessionRepository,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('access-token');
    repository.recordLoginAndCreateSession.mockResolvedValue(user);
  });

  it('issues a Tenant-bound access token and stores only the refresh hash', async () => {
    const result = await provider().issueLogin(
      user.id,
      tenantId,
      request,
      'verified-hash',
    );
    const tokens = result.tokens;

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(repository.recordLoginAndCreateSession).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        userId: user.id,
        refreshTokenHash: createHash('sha256')
          .update(tokens.refreshToken)
          .digest('hex'),
      }),
      'verified-hash',
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, type: 'access' }),
      expect.objectContaining({ subject: user.id, algorithm: 'HS256' }),
    );
  });

  it('rotates refresh tokens without extending the absolute TTL', async () => {
    const absoluteExpiresAt = new Date(Date.now() + 10_000);
    repository.findValidSessionByTokenHash.mockResolvedValue({
      id: 'session-1',
      tenantId,
      userId: user.id,
      absoluteExpiresAt,
    });
    repository.findActiveUser.mockResolvedValue(user);
    repository.rotateSession.mockResolvedValue(true);

    await provider().rotate('current-refresh', request);

    expect(repository.rotateSession).toHaveBeenCalledWith(
      'session-1',
      createHash('sha256').update('current-refresh').digest('hex'),
      expect.objectContaining({ expiresAt: absoluteExpiresAt }),
    );
  });

  it('detects consumed-token replay and revokes its session', async () => {
    repository.findValidSessionByTokenHash.mockResolvedValue(null);
    repository.findSessionByConsumedTokenHash.mockResolvedValue({
      id: 'session-1',
    });

    await expect(
      provider().rotate('replayed-refresh', request),
    ).rejects.toEqual(
      new UnauthorizedException('Invalid or expired refresh token'),
    );
    expect(repository.revokeSession).toHaveBeenCalledWith('session-1');
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('revokes logout sessions and rejects inactive sessions afterwards', async () => {
    repository.revokeSession.mockResolvedValue(undefined);
    repository.isSessionActive.mockResolvedValue(false);

    await provider().revoke('session-1');
    await expect(
      provider().isSessionActive('session-1', user.id),
    ).resolves.toBe(false);
    expect(repository.revokeSession).toHaveBeenCalledWith('session-1');
    expect(repository.isSessionActive).toHaveBeenCalledWith(
      'session-1',
      user.id,
    );
  });

  it('revokes a session when its User is no longer active', async () => {
    repository.findValidSessionByTokenHash.mockResolvedValue({
      id: 'session-1',
      tenantId,
      userId: user.id,
      absoluteExpiresAt: new Date(Date.now() + 10_000),
    });
    repository.findActiveUser.mockResolvedValue(null);

    await expect(provider().rotate('refresh', request)).rejects.toEqual(
      new UnauthorizedException('Invalid or expired refresh token'),
    );
    expect(repository.revokeSession).toHaveBeenCalledWith('session-1');
  });
});
