import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const sessionUserSelect = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  userRolesByUserId: {
    where: { revokedAt: null },
    select: {
      role: {
        select: {
          code: true,
          workflowActionRolePermissionsByRoleId: {
            where: { allowed: true },
            select: { action: { select: { code: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{
  select: typeof sessionUserSelect;
}>;
export type UserCredentials = Prisma.UserGetPayload<Record<string, never>>;

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCredentials(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: sessionUserSelect,
    });
  }

  recordLogin(id: string): Promise<SessionUser> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: sessionUserSelect,
    });
  }
}
