import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppConfiguration } from '../../config/configuration';
import {
  AccessTokenPayload,
  SessionAuthenticator,
} from '../../common/security/session-authenticator.port';
import { SessionActor, SessionUser } from '../../common/security/session.types';
import { AuthSessionRepository } from '../repositories';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Injectable()
export class AuthTokenProvider implements SessionAuthenticator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly repository: AuthSessionRepository,
  ) {}

  async issue(
    user: SessionUser,
    tenantId: string,
    request: Request,
  ): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const refreshToken = this.generateRefreshToken();
    const refreshTtl = this.config.get('jwt.refreshTtlSeconds', {
      infer: true,
    });
    const absoluteTtl = this.config.get('jwt.sessionAbsoluteTtlSeconds', {
      infer: true,
    });
    const now = Date.now();
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hash(refreshToken),
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      expiresAt: new Date(now + refreshTtl * 1000),
      absoluteExpiresAt: new Date(now + absoluteTtl * 1000),
    });
    return this.tokens(user.id, tenantId, sessionId, refreshToken);
  }

  async rotate(refreshToken: string, request: Request): Promise<AuthTokens> {
    const hash = this.hash(refreshToken);
    const session = await this.repository.findValidSessionByTokenHash(hash);
    if (!session) {
      const reused = await this.repository.findSessionByConsumedTokenHash(hash);
      if (reused) await this.repository.revokeSession(reused.id);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.repository.findActiveUser(session.userId);
    if (!user) {
      await this.repository.revokeSession(session.id);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const nextRefreshToken = this.generateRefreshToken();
    const refreshTtl = this.config.get('jwt.refreshTtlSeconds', {
      infer: true,
    });
    const expiresAt = new Date(
      Math.min(
        Date.now() + refreshTtl * 1000,
        session.absoluteExpiresAt.getTime(),
      ),
    );
    const rotated = await this.repository.rotateSession(session.id, hash, {
      refreshTokenHash: this.hash(nextRefreshToken),
      previousRefreshTokenHash: hash,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      expiresAt,
    });
    if (!rotated) {
      await this.repository.revokeSession(session.id);
      throw new UnauthorizedException('Refresh token has already been used');
    }
    return this.tokens(user.id, session.tenantId, session.id, nextRefreshToken);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.config.get('jwt.secret', { infer: true }),
          issuer: this.config.get('jwt.issuer', { infer: true }),
          audience: this.config.get('jwt.audience', { infer: true }),
          algorithms: ['HS256'],
        },
      );
      if (
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        typeof payload.tenantId !== 'string' ||
        payload.tenantId.length === 0 ||
        typeof payload.sid !== 'string' ||
        payload.sid.length === 0
      ) {
        throw new Error('Invalid access token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  isSessionActive(id: string, userId: string): Promise<boolean> {
    return this.repository.isSessionActive(id, userId);
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    return this.repository.findActiveUser(id);
  }

  findActiveActor(userId: string): Promise<SessionActor | null> {
    return this.repository.findActiveActor(userId);
  }

  revoke(id: string): Promise<void> {
    return this.repository.revokeSession(id);
  }

  private async tokens(
    userId: string,
    tenantId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const expiresIn = this.config.get('jwt.accessTtlSeconds', { infer: true });
    const accessToken = await this.jwtService.signAsync(
      { tenantId, sid: sessionId, type: 'access' } satisfies Omit<
        AccessTokenPayload,
        'sub'
      >,
      {
        subject: userId,
        secret: this.config.get('jwt.secret', { infer: true }),
        issuer: this.config.get('jwt.issuer', { infer: true }),
        audience: this.config.get('jwt.audience', { infer: true }),
        algorithm: 'HS256',
        expiresIn,
      },
    );
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
