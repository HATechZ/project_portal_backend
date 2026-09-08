import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class PasswordRecoveryRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findActiveCredentials(email: string) {
    return this.transaction((db) =>
      db.user.findFirst({
        where: { email, isActive: true, passwordHash: { not: null } },
        select: { id: true, email: true, fullName: true },
      }),
    );
  }

  replacePasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const user = await db.user.findFirst({
        where: { id: userId, tenantId, isActive: true },
        select: { id: true },
      });
      if (!user) return;
      await db.passwordResetToken.updateMany({
        where: { tenantId, userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await db.passwordResetToken.create({
        data: { tenantId, id: randomUUID(), userId, tokenHash, expiresAt },
      });
    });
  }

  retireUndeliveredToken(tokenHash: string): Promise<unknown> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.passwordResetToken.updateMany({
        where: { tenantId, tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      }),
    );
  }

  resetPassword(tokenHash: string, passwordHash: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const candidate = await db.passwordResetToken.findFirst({
        where: { tenantId, tokenHash },
        select: { userId: true },
      });
      if (!candidate) return false;
      // Same lock order as recovery issuance, login and account mutations.
      await db.$queryRaw`SELECT id FROM users WHERE id = ${candidate.userId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const token = await db.passwordResetToken.findFirst({
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
      const consumed = await db.passwordResetToken.updateMany({
        where: {
          tenantId,
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await db.user.update({
        where: { id: token.userId, tenantId },
        data: { passwordHash, updatedAt: new Date() },
      });
      await db.passwordResetToken.updateMany({
        where: { tenantId, userId: token.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await db.authSession.updateMany({
        where: { tenantId, userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return true;
    });
  }
}
