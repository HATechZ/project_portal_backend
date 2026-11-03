import { AuthService } from './auth.service';

describe('AuthService logout', () => {
  it('revokes the authenticated session so its access and refresh tokens cannot be reused', async () => {
    const tokenProvider = { revoke: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      {} as never,
      {} as never,
      tokenProvider as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.logout('session-id');

    expect(tokenProvider.revoke).toHaveBeenCalledWith('session-id');
  });
});
