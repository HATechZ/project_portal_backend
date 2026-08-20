import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaginationArgs } from '../../common/pagination/paginate';

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

  create(data: Omit<Prisma.UserCreateInput, 'id'>): Promise<PublicUser> {
    return this.prisma.user.create({
      data: { id: randomUUID(), ...data },
      select: publicUserSelect,
    });
  }

  findAll({ skip, take }: PaginationArgs): Promise<PublicUser[]> {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      skip,
      take,
      select: publicUserSelect,
    });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      select: publicUserSelect,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
