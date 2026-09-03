import { CompanySignupService } from './company-signup.service';
import { CompanySignupDto } from './dtos';
import { CompanySignupRepository } from './repositories';

describe('CompanySignupService', () => {
  const repository = { provision: jest.fn() };
  const passwordHasher = { hash: jest.fn(), compare: jest.fn() };
  const input: CompanySignupDto = {
    company: {
      name: 'Tech Marine Solutions Ltd',
      abbr: 'TMS',
      companyTypeId: '20000000-0000-4000-8000-000000000001',
    },
    admin: {
      fullName: 'Nayeem Rahman',
      email: 'nayeem@techmarine.com',
      password: 'SecurePassword123',
      country: 'Bangladesh',
      phone: '+880 1711-234567',
    },
    termsAccepted: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('hashes plaintext and provisions the complete workspace once', async () => {
    passwordHasher.hash.mockResolvedValue('bcrypt-hash');
    repository.provision.mockResolvedValue({
      companyId: 'company-id',
      userId: 'user-id',
    });
    const service = new CompanySignupService(
      repository as unknown as CompanySignupRepository,
      passwordHasher,
    );

    const result = await service.signup(input);

    expect(passwordHasher.hash).toHaveBeenCalledWith('SecurePassword123');
    expect(repository.provision).toHaveBeenCalledTimes(1);
    expect(repository.provision).toHaveBeenCalledWith(
      expect.objectContaining({
        adminPasswordHash: 'bcrypt-hash',
        adminCountry: 'Bangladesh',
        adminPhone: '+880 1711-234567',
      }),
    );
    expect(repository.provision).toHaveBeenCalledWith(
      expect.not.objectContaining({ password: 'SecurePassword123' }),
    );
    expect(result).not.toHaveProperty('tenantId');
  });

  it('does not provision when password hashing fails', async () => {
    passwordHasher.hash.mockRejectedValue(new Error('hash failed'));
    const service = new CompanySignupService(
      repository as unknown as CompanySignupRepository,
      passwordHasher,
    );

    await expect(service.signup(input)).rejects.toThrow('hash failed');
    expect(repository.provision).not.toHaveBeenCalled();
  });
});
