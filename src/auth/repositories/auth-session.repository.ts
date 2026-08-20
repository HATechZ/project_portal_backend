import { Injectable } from '@nestjs/common';
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
export type UserCredentials = Prisma.UserGetPayload<Record<string, never>>;

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCredentials(email: string): Promise<UserCredentials | null> {
    return this.prisma.scoped.user.findFirst({ where: { email } });
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.user.findFirst({
      where: { id, isActive: true },
      select: sessionUserSelect(tenantId),
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
}
