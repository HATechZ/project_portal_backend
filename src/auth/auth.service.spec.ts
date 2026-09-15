jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RequestContext } from '../common/context/request-context';

const tenantId = '11111111-1111-4111-8111-111111111111';
const API_SECURITY_METADATA = 'swagger/apiSecurity';

describe('AuthService refresh tenant resolution', () => {
  it('derives tenant context from the refresh token without a tenant header', async () => {
    const refreshTenantResolver = {
      resolve: jest.fn(() => Promise.resolve({ tenantId })),
    };
    const tokenProvider = {
      hashRefreshToken: jest.fn(() => 'refresh-token-hash'),
      rotate: jest.fn(() => {
        expect(RequestContext.requireTenantId()).toBe(tenantId);
        return Promise.resolve({
          accessToken: 'access-token',
          refreshToken: 'next-refresh-token',
          tokenType: 'Bearer' as const,
          expiresIn: 900,
        });
      }),
    };
    const tenants = { isActive: jest.fn(() => Promise.resolve(true)) };
    const service = new AuthService(
      {} as never,
      {} as never,
      tokenProvider as never,
      {} as never,
      {} as never,
      refreshTenantResolver as never,
      tenants as never,
    );
    const request = { headers: {} } as never;

    const result = await RequestContext.run({ requestId: 'request-id' }, () =>
      service.refresh(request, 'fresh-refresh-token'),
    );

    expect(refreshTenantResolver.resolve).toHaveBeenCalledWith(
      'refresh-token-hash',
    );
    expect(tenants.isActive).toHaveBeenCalledWith(tenantId);
    expect(tokenProvider.rotate).toHaveBeenCalledWith(
      'fresh-refresh-token',
      request,
    );
    expect(result.tokens.refreshToken).toBe('next-refresh-token');
  });

  it('does not declare tenant API-key security for refresh', () => {
    const refresh = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'refresh',
    )?.value as object;
    const forgotPassword = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'forgotPassword',
    )?.value as object;

    expect(Reflect.getMetadata(API_SECURITY_METADATA, refresh)).toBeUndefined();
    expect(Reflect.getMetadata(API_SECURITY_METADATA, forgotPassword)).toEqual([
      { tenant: [] },
    ]);
  });
});
