import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './dtos';

describe('LoginDto', () => {
  const valid = () => ({
    email: ' USER@EXAMPLE.COM ',
    password: 'SecurePassword123',
  });

  it('normalizes and accepts the universal Sign In contract', async () => {
    const dto = plainToInstance(LoginDto, valid());
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
  });

  it.each(['email', 'password'])('requires %s', async (field) => {
    const payload = valid() as Record<string, unknown>;
    delete payload[field];
    expect(await validate(plainToInstance(LoginDto, payload))).not.toHaveLength(
      0,
    );
  });

  it.each(['workspaceSlug', 'tenantId', 'companyId', 'role', 'actorProfileId'])(
    'rejects caller-controlled %s',
    async (field) => {
      const payload = { ...valid(), [field]: 'caller-controlled' };
      expect(
        await validate(plainToInstance(LoginDto, payload), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      ).not.toHaveLength(0);
    },
  );
});
