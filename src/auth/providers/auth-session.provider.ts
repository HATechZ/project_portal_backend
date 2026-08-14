import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import 'express-session';
import { Prisma } from '../../generated/prisma/client';
import { LoginDto, RegisterDto } from '../dtos';
import { AuthSessionRepository, SessionUser } from '../repositories';
import { AuthHashingProvider } from './auth-hashing.provider';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

@Injectable()
export class AuthSessionProvider {
  constructor(
    private readonly repository: AuthSessionRepository,
    private readonly hashingProvider: AuthHashingProvider,
  ) {}

  async login(
    request: Request,
    { email, password }: LoginDto,
  ): Promise<SessionUser> {
    const credentials = await this.repository.findCredentials(email);
    const valid =
      credentials?.isActive === true &&
      typeof credentials.passwordHash === 'string' &&
      (await this.hashingProvider.compare(password, credentials.passwordHash));
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    await this.regenerate(request);
    request.session.userId = credentials.id;
    await this.save(request);
    return this.repository.recordLogin(credentials.id);
  }

  async register(
    request: Request,
    { fullName, email, password, avatarUrl }: RegisterDto,
  ): Promise<SessionUser> {
    try {
      const user = await this.repository.createUser({
        fullName,
        email,
        avatarUrl,
        passwordHash: await this.hashingProvider.hash(password),
      });
      await this.regenerate(request);
      request.session.userId = user.id;
      await this.save(request);
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  findActiveUser(id: string): Promise<SessionUser | null> {
    return this.repository.findActiveUser(id);
  }

  async logout(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.session.destroy((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
  }

  private async regenerate(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
  }

  private async save(request: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      request.session.save((error) =>
        error ? reject(this.asError(error)) : resolve(),
      ),
    );
  }

  private asError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
  }
}
