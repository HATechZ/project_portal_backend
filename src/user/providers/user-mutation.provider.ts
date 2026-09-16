import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
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
    return this.repository.create({
      fullName: fullName.trim(),
      email: this.normalizeEmail(email),
      avatarUrl,
      passwordHash: await this.hashingProvider.hash(password),
    });
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
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Some information is invalid. Correct the highlighted fields and try again.',
      });
    }
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
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'This role cannot be removed because the workspace must have at least one active System Administrator.',
      });
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
