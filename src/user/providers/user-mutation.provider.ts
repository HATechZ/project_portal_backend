import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AuthHashingProvider } from '../../auth/providers';
import { CreateUserDto, UpdateUserDto } from '../dtos';
import { PublicUser, UserRepository } from '../repositories';

@Injectable()
export class UserMutationProvider {
  constructor(
    private readonly repository: UserRepository,
    private readonly hashingProvider: AuthHashingProvider,
  ) {}

  async create({
    fullName,
    email,
    password,
    avatarUrl,
  }: CreateUserDto): Promise<PublicUser> {
    try {
      return await this.repository.create({
        fullName,
        email,
        avatarUrl,
        passwordHash: await this.hashingProvider.hash(password),
      });
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    id: string,
    { fullName, email, password, avatarUrl }: UpdateUserDto,
  ): Promise<PublicUser> {
    if (
      fullName === undefined &&
      email === undefined &&
      password === undefined &&
      avatarUrl === undefined
    ) {
      throw new BadRequestException('At least one field is required');
    }
    try {
      return await this.repository.update(id, {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(password !== undefined
          ? { passwordHash: await this.hashingProvider.hash(password) }
          : {}),
      });
    } catch (error) {
      this.handlePersistenceError(error, id);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      this.handlePersistenceError(error, id);
    }
  }

  private handlePersistenceError(error: unknown, id?: string): never {
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
}
