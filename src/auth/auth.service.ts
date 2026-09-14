import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
  RefreshTenantResolverRepository,
} from './repositories';
import { SessionUser } from '../common/security/session.types';
import { RequestContext } from '../common/context/request-context';
import { TenantActivationService } from '../common/tenant/tenant-activation.service';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../infra/crypto/password-hasher.port';

// A fixed non-credential hash equalizes the expensive password-check path when
// pre-auth email resolution finds no eligible account.
const LOGIN_TIMING_DUMMY_HASH =
  '$2b$12$5oMkgG3FQJFzjn73Y2VeIePNywlfB09WEtdnALM/tCx3FKyYzutC2';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthSessionRepository,
    @Inject(PASSWORD_HASHER)
    private readonly hashingProvider: PasswordHasher,
    private readonly tokenProvider: AuthTokenProvider,
    private readonly passwordResetProvider: AuthPasswordResetProvider,
    private readonly loginTenantResolver: LoginTenantResolverRepository,
    private readonly refreshTenantResolver: RefreshTenantResolverRepository,
    private readonly tenants: TenantActivationService,
  ) {}

  async login(request: Request, input: LoginDto): Promise<LoginResponseDto> {
    const resolved = await this.loginTenantResolver.resolve(input.email);
    if (!resolved) {
      await this.hashingProvider.compare(
        input.password,
        LOGIN_TIMING_DUMMY_HASH,
      );
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
    const issued = await this.tokenProvider.issueLogin(
      credentials.id,
      tenantId,
      request,
      credentials.passwordHash!,
    );
    return { user: toAuthUserResponse(issued.user), tokens: issued.tokens };
  }

  async refresh(
    request: Request,
    refreshToken: string,
  ): Promise<RefreshResponseDto> {
    const resolved = await this.refreshTenantResolver.resolve(
      this.tokenProvider.hashRefreshToken(refreshToken),
    );
    if (!resolved) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const currentContext = RequestContext.get();
    if (!currentContext) throw new Error('Request context is required');

    return RequestContext.run(
      { ...currentContext, tenantId: resolved.tenantId },
      async () => {
        if (!(await this.tenants.isActive(resolved.tenantId))) {
          throw new ForbiddenException('Tenant is not active');
        }
        const tokens = await this.tokenProvider.rotate(refreshToken, request);
        return { tokens };
      },
    );
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
