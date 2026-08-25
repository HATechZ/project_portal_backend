import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthUserResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
} from './dtos';
import { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import {
  AuthHashingProvider,
  toAuthUserResponse,
  AuthTokenProvider,
} from './providers';
import { AuthSessionRepository, SessionUser } from './repositories';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthSessionRepository,
    private readonly hashingProvider: AuthHashingProvider,
    private readonly tokenProvider: AuthTokenProvider,
    private readonly passwordResetProvider: AuthPasswordResetProvider,
  ) {}

  async login(request: Request, input: LoginDto): Promise<LoginResponseDto> {
    const credentials = await this.repository.findCredentials(input.email);
    const valid =
      credentials?.isActive === true &&
      typeof credentials.passwordHash === 'string' &&
      (await this.hashingProvider.compare(
        input.password,
        credentials.passwordHash,
      ));
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const user = await this.repository.recordLogin(credentials.id);
    const tokens = await this.tokenProvider.issue(
      user,
      credentials.tenantId,
      request,
    );
    return { user: toAuthUserResponse(user), tokens };
  }

  async refresh(
    request: Request,
    refreshToken: string,
  ): Promise<RefreshResponseDto> {
    const tokens = await this.tokenProvider.rotate(refreshToken, request);
    return { tokens };
  }

  logout(sessionId: string): Promise<void> {
    return this.tokenProvider.revoke(sessionId);
  }

  forgotPassword(email: string): Promise<void> {
    return this.passwordResetProvider.request(email);
  }

  resetPassword(token: string, newPassword: string): Promise<void> {
    return this.passwordResetProvider.reset(token, newPassword);
  }

  currentUser(user: SessionUser): AuthUserResponseDto {
    return toAuthUserResponse(user);
  }
}
