import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../infra/crypto/password-hasher.port';
import { CreateUserDto, UpdateUserDto } from '../dtos';
import { PublicUser, UserRepository } from '../repositories';

@Injectable()
export class UserMutationProvider {
  constructor(
    private readonly repository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hashingProvider: PasswordHasher,
  ) {}

  async create({
    fullName,
    email,
    password,
    avatarUrl,
  }: CreateUserDto): Promise<PublicUser> {
    try {
      return await this.repository.create({
        fullName: fullName.trim(),
        email: this.normalizeEmail(email),
        avatarUrl,
        passwordHash: await this.hashingProvider.hash(password),
      });
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async update(
    id: string,
    { fullName, email, password, avatarUrl, isActive }: UpdateUserDto,
  ): Promise<PublicUser> {
    if (
      fullName === undefined &&
      email === undefined &&
      password === undefined &&
      avatarUrl === undefined &&
      isActive === undefined
    ) {
      throw new BadRequestException('At least one field is required');
    }
    try {
      const updated = await this.repository.update(
        id,
        {
          ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
          ...(email !== undefined ? { email: this.normalizeEmail(email) } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(password !== undefined
            ? { passwordHash: await this.hashingProvider.hash(password) }
            : {}),
        },
        {
          deactivating: isActive === false,
          passwordChanged: password !== undefined,
        },
      );
      if (!updated) {
        throw new ConflictException(
          'The tenant must retain at least one active system administrator',
        );
      }
      return updated;
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
      // Unique violations are translated centrally by `mapPrismaException`
      // (Art. VI.4); the message lives in its constraint map, not here.
      if (error.code === 'P2025' && id !== undefined) {
        throw new NotFoundException(`User with ID ${id} was not found`);
      }
      if (error.code === 'P2003' && id !== undefined) {
        throw new ConflictException(
          'This user is referenced by other records and cannot be deleted',
        );
      }
      if (error.code === 'P2034') {
        throw new ConflictException(
          'The user changed concurrently; retry the request',
        );
      }
    }
    throw error;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
