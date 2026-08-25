import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RequestContext } from '../../common/context/request-context';

const sessionUserSelect = (tenantId: string) =>
  ({
    id: true,
    fullName: true,
    email: true,
    avatarUrl: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    userRolesByUserId: {
      where: { revokedAt: null, tenantId },
      select: {
        role: {
          select: {
            code: true,
            workflowActionRolePermissionsByRoleId: {
              where: { allowed: true, tenantId },
              select: { action: { select: { code: true } } },
            },
          },
        },
      },
    },
  }) satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{
  select: ReturnType<typeof sessionUserSelect>;
}>;
const sessionActorSelect = (tenantId: string) =>
  ({
    id: true,
    roleId: true,
    memberId: true,
    clientContactId: true,
    label: true,
    isDefault: true,
    role: {
      select: {
        code: true,
        workflowActionRolePermissionsByRoleId: {
          where: { tenantId, allowed: true },
          select: { action: { select: { code: true } } },
        },
      },
    },
  }) satisfies Prisma.ActorProfileSelect;
export type SessionActor = Prisma.ActorProfileGetPayload<{
  select: ReturnType<typeof sessionActorSelect>;
}>;
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
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCredentials(email: string): Promise<UserCredentials | null> {
    return this.prisma.scoped.user.findFirst({ where: { email } });
  }

  findActiveCredentials(email: string): Promise<UserCredentials | null> {
    return this.prisma.scoped.user.findFirst({
      where: { email, isActive: true, passwordHash: { not: null } },
    });
  }

  async replacePasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    await this.prisma.unscoped.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { tenantId, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.passwordResetToken.create({
        data: {
          tenantId,
          id: randomUUID(),
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });
  }

  async resetPassword(
    tokenHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.unscoped.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findFirst({
        where: {
          tenantId,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
          user: { isActive: true },
        },
        select: { id: true, userId: true },
      });
      if (!token) return false;

      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          tenantId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;

      const updated = await transaction.user.updateMany({
        where: { id: token.userId, tenantId, isActive: true },
        data: { passwordHash, updatedAt: new Date() },
      });
      if (updated.count !== 1) return false;

      await transaction.authSession.updateMany({
        where: { tenantId, userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.user.findFirst({
      where: { id, isActive: true },
      select: sessionUserSelect(tenantId),
    });
  }

  findActiveActor(userId: string): Promise<SessionActor | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.actorProfile.findFirst({
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
    });
  }

  recordLogin(id: string): Promise<SessionUser> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: sessionUserSelect(tenantId),
    });
  }

  createSession(data: CreateAuthSessionInput) {
    return this.prisma.scoped.authSession.create({
      data: data as Prisma.AuthSessionUncheckedCreateInput,
    });
  }

  findValidSessionByTokenHash(refreshTokenHash: string) {
    return this.prisma.scoped.authSession.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        absoluteExpiresAt: { gt: new Date() },
      },
    });
  }

  async findSessionByConsumedTokenHash(tokenHash: string) {
    const previous = await this.prisma.scoped.authSession.findFirst({
      where: { previousRefreshTokenHash: tokenHash, revokedAt: null },
      select: { id: true },
    });
    if (previous) return previous;

    const consumed =
      await this.prisma.scoped.authSessionConsumedRefreshToken.findFirst({
        where: { tokenHash, session: { revokedAt: null } },
        select: { sessionId: true },
      });
    return consumed ? { id: consumed.sessionId } : null;
  }

  async isSessionActive(id: string, userId: string): Promise<boolean> {
    const session = await this.prisma.scoped.authSession.findFirst({
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
    return this.prisma.unscoped.$transaction(async (transaction) => {
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
    await this.prisma.scoped.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
