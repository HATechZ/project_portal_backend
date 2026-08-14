import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthUser } from './auth-user.type';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid =
      user?.isActive === true &&
      typeof user.passwordHash === 'string' &&
      (await compare(password, user.passwordHash));

    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.toAuthUser(user);
  }

  async findSessionUser(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user?.isActive) return null;
    return this.toAuthUser(user);
  }

  async recordLogin(id: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
    return this.toAuthUser(user);
  }

  private toAuthUser(
    user: AuthUser & { passwordHash: string | null },
  ): AuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
