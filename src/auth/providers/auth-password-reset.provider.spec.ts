import { AuthPasswordResetProvider } from './auth-password-reset.provider';

describe('AuthPasswordResetProvider setup initiation', () => {
  it('delegates internal setup initiation to the established recovery flow', async () => {
    const provider = Object.create(
      AuthPasswordResetProvider.prototype,
    ) as AuthPasswordResetProvider;
    const request = jest.spyOn(provider, 'request').mockResolvedValue();

    await provider.initiate('client@example.com');

    expect(request).toHaveBeenCalledWith('client@example.com');
  });
});
