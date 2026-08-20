import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;
      return await this.prisma.user.create({
        data: {
          id: randomUUID(),
          ...userData,
          passwordHash: await hash(password, 12),
        },
        select: this.publicUserSelect,
      });
    } catch (error) {
      this.handleKnownError(error);
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: this.publicUserSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} was not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const { password, ...userData } = updateUserDto;
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...userData,
          ...(password ? { passwordHash: await hash(password, 12) } : {}),
        },
        select: this.publicUserSelect,
      });
    } catch (error) {
      this.handleKnownError(error, id);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      this.handleKnownError(error, id);
    }
  }

  private handleKnownError(error: unknown, id?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }

      if (error.code === 'P2025' && id !== undefined) {
        throw new NotFoundException(`User with ID ${id} was not found`);
      }
    }

    throw error;
  }

  private readonly publicUserSelect = {
    id: true,
    fullName: true,
    email: true,
    avatarUrl: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.UserSelect;
}
