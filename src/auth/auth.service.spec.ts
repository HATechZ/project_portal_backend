import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RequestContext } from '../common/context/request-context';
import { SessionUser } from '../common/security/session.types';
jest.mock('./providers', () => ({
  AuthTokenProvider: class AuthTokenProvider {},
  toAuthUserResponse: (user: SessionUser) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roles: [],
    permissions: [],
  }),
}));
import { AuthService } from './auth.service';
import { LoginDto } from './dtos';
import type { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import type { AuthTokenProvider } from './providers/auth-token.provider';
import {
  AuthSessionRepository,
  LoginTenantResolverRepository,
} from './repositories';

describe('AuthService universal Sign In', () => {
  const tenantA = '10000000-0000-4000-8000-000000000001';
  const tenantB = '10000000-0000-4000-8000-000000000002';
  const request = { headers: { 'x-tenant-id': tenantB } } as Request;
  const loginTenantResolver = { resolve: jest.fn() };
  const repository = {
    findCredentials: jest.fn(),
    recordLogin: jest.fn(),
  };
  const hashingProvider = { hash: jest.fn(), compare: jest.fn() };
  const tokenProvider = { issue: jest.fn() };
  const resetProvider = {};

  const input = (email = 'user@example.com'): LoginDto => ({
    email,
    password: 'SecurePassword123',
  });

  const user = (id: string, tenantId: string) =>
    ({
      id,
      tenantId,
      email: 'shared@example.com',
      passwordHash: 'stored-hash',
      isActive: true,
      userRolesByUserId: [],
    }) as unknown as SessionUser & { tenantId: string; passwordHash: string };

  const service = () =>
    new AuthService(
      repository as unknown as AuthSessionRepository,
      hashingProvider,
      tokenProvider as unknown as AuthTokenProvider,
      resetProvider as unknown as AuthPasswordResetProvider,
      loginTenantResolver as unknown as LoginTenantResolverRepository,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    hashingProvider.compare.mockResolvedValue(true);
    tokenProvider.issue.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    loginTenantResolver.resolve.mockResolvedValue({ tenantId: tenantA });
    repository.findCredentials.mockImplementation(() => {
      const tenantId = RequestContext.requireTenantId();
      return Promise.resolve(
        tenantId === tenantA
          ? user('user-a', tenantA)
          : tenantId === tenantB
            ? user('user-b', tenantB)
            : null,
      );
    });
    repository.recordLogin.mockImplementation((id: string) =>
      Promise.resolve(user(id, RequestContext.requireTenantId())),
    );
  });

  it('resolves Tenant from email and authenticates without workspace input', async () => {
    const result = await RequestContext.run({ requestId: 'login' }, () =>
      service().login(request, input()),
    );
    expect(result.user.id).toBe('user-a');
    expect(loginTenantResolver.resolve).toHaveBeenCalledWith(
      'user@example.com',
    );
    expect(tokenProvider.issue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-a' }),
      tenantA,
      request,
    );
  });

  it('ignores caller Tenant context in favor of email resolution', async () => {
    await RequestContext.run({ requestId: 'login', tenantId: tenantB }, () =>
      service().login(request, input()),
    );
    expect(repository.recordLogin).toHaveBeenCalledWith('user-a');
    expect(tokenProvider.issue).toHaveBeenCalledWith(
      expect.anything(),
      tenantA,
      request,
    );
  });

  it.each([
    ['unknown email', 'missing@example.com', true],
    ['wrong password', 'user@example.com', false],
  ])('uses one generic failure for %s', async (_case, email, passwordValid) => {
    if (email === 'missing@example.com') {
      loginTenantResolver.resolve.mockResolvedValueOnce(null);
    }
    hashingProvider.compare.mockResolvedValueOnce(passwordValid);

    const attempt = RequestContext.run({ requestId: 'login' }, () =>
      service().login(request, input(email)),
    );
    await expect(attempt).rejects.toEqual(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('preserves inactive User rejection', async () => {
    repository.findCredentials.mockResolvedValueOnce({
      ...user('user-a', tenantA),
      isActive: false,
    });
    const attempt = RequestContext.run({ requestId: 'login' }, () =>
      service().login(request, input()),
    );
    await expect(attempt).rejects.toEqual(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(tokenProvider.issue).not.toHaveBeenCalled();
  });
});
