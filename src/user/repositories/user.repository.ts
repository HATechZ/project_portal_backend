import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaginationArgs } from '../../common/pagination/paginate';
import { RequestContext } from '../../common/context/request-context';

export const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Omit<Prisma.UserUncheckedCreateInput, 'id' | 'tenantId'>,
  ): Promise<PublicUser> {
    return this.prisma.scoped.user.create({
      data: {
        id: randomUUID(),
        ...data,
      } as unknown as Prisma.UserUncheckedCreateInput,
      select: publicUserSelect,
    });
  }

  findAll({ skip, take }: PaginationArgs): Promise<PublicUser[]> {
    return this.prisma.scoped.user.findMany({
      orderBy: { id: 'asc' },
      skip,
      take,
      select: publicUserSelect,
    });
  }

  count(): Promise<number> {
    return this.prisma.scoped.user.count();
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.scoped.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  update(
    id: string,
    data: Prisma.UserUpdateInput,
    security: { deactivating: boolean; passwordChanged: boolean },
  ): Promise<PublicUser | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.unscoped.$transaction(
      async (transaction) => {
        if (security.deactivating) {
          const targetIsSystemAdmin = await transaction.user.findFirst({
            where: {
              tenantId,
              id,
              isActive: true,
              userRolesByUserId: {
                some: {
                  tenantId,
                  revokedAt: null,
                  role: { code: ActorRoleCode.system_admin },
                },
              },
            },
            select: { id: true },
          });
          if (targetIsSystemAdmin) {
            const activeSystemAdministrators = await transaction.user.count({
              where: {
                tenantId,
                isActive: true,
                userRolesByUserId: {
                  some: {
                    tenantId,
                    revokedAt: null,
                    role: { code: ActorRoleCode.system_admin },
                  },
                },
              },
            });
            if (activeSystemAdministrators <= 1) return null;
          }
        }

        const user = await transaction.user.update({
          where: { id, tenantId },
          data: { ...data, updatedAt: new Date() },
          select: publicUserSelect,
        });
        if (security.passwordChanged || security.deactivating) {
          await transaction.authSession.updateMany({
            where: { tenantId, userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return user;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.scoped.user.delete({ where: { id } });
  }
}
