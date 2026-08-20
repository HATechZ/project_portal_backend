import { normalizeApiPrefix } from './configuration';
import { EnvironmentVariables } from './env';
import { environmentSchema } from './env.schema';

describe('normalizeApiPrefix', () => {
  it.each([
    [undefined, 'api'],
    ['api', 'api'],
    ['/api/', 'api'],
    ['api/v1', 'api'],
    ['/api/v1/', 'api'],
  ])('normalizes %p to %p', (value, expected) => {
    expect(normalizeApiPrefix(value)).toBe(expected);
  });
});

describe('environmentSchema', () => {
  const databaseUrl = 'postgresql://user:password@localhost:5432/portal';

  it('uses a development session-secret default', () => {
    const result = environmentSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: databaseUrl,
    });
    const value = result.value as EnvironmentVariables;

    expect(result.error).toBeUndefined();
    expect(value.SESSION_SECRET).toBe('change-this-session-secret');
  });

  it('requires an explicit session secret in production', () => {
    const { error } = environmentSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
    });

    expect(error?.message).toContain('SESSION_SECRET');
  });

  it('requires SMTP username and password together', () => {
    const { error } = environmentSchema.validate({
      DATABASE_URL: databaseUrl,
      SMTP_USER: 'mailer',
    });

    expect(error?.message).toContain('SMTP_PASSWORD');
  });
});
