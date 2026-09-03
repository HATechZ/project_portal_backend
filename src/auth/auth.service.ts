import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthUserResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
} from './dtos';
import { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import { toAuthUserResponse, AuthTokenProvider } from './providers';
import {
  AuthSessionRepository,
  LoginTenantResolverRepository,
} from './repositories';
import { SessionUser } from '../common/security/session.types';
import { RequestContext } from '../common/context/request-context';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../infra/crypto/password-hasher.port';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthSessionRepository,
    @Inject(PASSWORD_HASHER)
    private readonly hashingProvider: PasswordHasher,
    private readonly tokenProvider: AuthTokenProvider,
    private readonly passwordResetProvider: AuthPasswordResetProvider,
    private readonly loginTenantResolver: LoginTenantResolverRepository,
  ) {}

  async login(request: Request, input: LoginDto): Promise<LoginResponseDto> {
    const resolved = await this.loginTenantResolver.resolve(input.email);
    if (!resolved) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const currentContext = RequestContext.get();
    if (!currentContext) throw new Error('Request context is required');
    return RequestContext.run(
      { requestId: currentContext.requestId, tenantId: resolved.tenantId },
      () => this.loginInTenant(request, input, resolved.tenantId),
    );
  }

  private async loginInTenant(
    request: Request,
    input: LoginDto,
    tenantId: string,
  ): Promise<LoginResponseDto> {
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
    const tokens = await this.tokenProvider.issue(user, tenantId, request);
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
