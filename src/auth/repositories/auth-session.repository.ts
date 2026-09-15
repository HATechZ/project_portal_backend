import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { RequestContext } from '../../common/context/request-context';
import {
  SessionActor,
  SessionUser,
  sessionActorSelect,
  sessionUserSelect,
} from '../../common/security/session.types';

export type UserCredentials = Prisma.UserGetPayload<Record<string, never>>;

export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class AuthSessionRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findCredentials(email: string): Promise<UserCredentials | null> {
    return this.transaction((db) => db.user.findFirst({ where: { email } }));
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.user.findFirst({
        where: { id, isActive: true },
        select: sessionUserSelect(tenantId),
      }),
    );
  }

  findActiveActor(userId: string): Promise<SessionActor | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.actorProfile.findFirst({
        where: {
          userId,
          isActive: true,
          role: {
            userRolesByRoleId: {
              some: { tenantId, userId, revokedAt: null },
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: sessionActorSelect(tenantId),
      }),
    );
  }

  recordLoginAndCreateSession(
    id: string,
    session: CreateAuthSessionInput,
    expectedPasswordHash: string,
  ): Promise<SessionUser | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      // Recheck the verified credential while taking the User write lock. Reset,
      // deactivation and operator revocation serialize against session creation.
      const updated = await db.user.updateMany({
        where: {
          id,
          tenantId,
          isActive: true,
          passwordHash: expectedPasswordHash,
        },
        data: { lastLoginAt: new Date() },
      });
      if (updated.count !== 1) return null;
      const user = await db.user.findUniqueOrThrow({
        where: { id, tenantId },
        select: sessionUserSelect(tenantId),
      });
      await db.authSession.create({
        data: session as Prisma.AuthSessionUncheckedCreateInput,
      });
      return user;
    });
  }

  findValidSessionByTokenHash(refreshTokenHash: string) {
    return this.transaction((db) =>
      db.authSession.findFirst({
        where: {
          refreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          absoluteExpiresAt: { gt: new Date() },
        },
      }),
    );
  }

  async findSessionByConsumedTokenHash(tokenHash: string) {
    return this.transaction(async (db) => {
      const previous = await db.authSession.findFirst({
        where: { previousRefreshTokenHash: tokenHash, revokedAt: null },
        select: { id: true },
      });
      if (previous) return previous;
      const consumed = await db.authSessionConsumedRefreshToken.findFirst({
        where: { tokenHash, session: { revokedAt: null } },
        select: { sessionId: true },
      });
      return consumed ? { id: consumed.sessionId } : null;
    });
  }

  async isSessionActive(id: string, userId: string): Promise<boolean> {
    return this.transaction(async (db) => {
      const session = await db.authSession.findFirst({
        where: {
          id,
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          absoluteExpiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      return session !== null;
    });
  }

  async rotateSession(
    id: string,
    currentRefreshTokenHash: string,
    data: Pick<
      CreateAuthSessionInput,
      | 'refreshTokenHash'
      | 'previousRefreshTokenHash'
      | 'ipAddress'
      | 'userAgent'
      | 'expiresAt'
    >,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (transaction) => {
      const result = await transaction.authSession.updateMany({
        where: {
          tenantId,
          id,
          refreshTokenHash: currentRefreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          absoluteExpiresAt: { gt: new Date() },
        },
        data: { ...data, tenantId },
      });
      if (result.count !== 1) return false;

      await transaction.authSessionConsumedRefreshToken.create({
        data: {
          tenantId,
          id: randomUUID(),
          sessionId: id,
          tokenHash: currentRefreshTokenHash,
        },
      });
      return true;
    });
  }

  async revokeSession(id: string): Promise<void> {
    await this.transaction((db) =>
      db.authSession.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }
}
