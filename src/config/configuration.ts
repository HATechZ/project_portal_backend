import { EnvironmentVariables } from './env';

export function normalizeApiPrefix(value?: string): string {
  const prefix = (value ?? 'api').trim().replace(/^\/+|\/+$/g, '');
  const unversionedPrefix = prefix.replace(/\/v1$/i, '');

  return unversionedPrefix || 'api';
}

export interface AppConfiguration {
  app: {
    env: EnvironmentVariables['NODE_ENV'];
    port: number;
    apiPrefix: string;
    corsOrigins: string[];
  };
  database: { url: string };
  redis: { url: string; keyPrefix: string };
  jwt: {
    secret: string;
    issuer: string;
    audience: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
    sessionAbsoluteTtlSeconds: number;
    passwordResetTtlSeconds: number;
    passwordResetUrl: string;
  };
  throttler: { ttlMs: number; limit: number };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
    queueName: string;
    workerEnabled: boolean;
  };
}

export default function configuration(): AppConfiguration {
  return {
    app: {
      env: (process.env.NODE_ENV ??
        'development') as EnvironmentVariables['NODE_ENV'],
      port: Number(process.env.PORT ?? 3000),
      apiPrefix: normalizeApiPrefix(process.env.API_PREFIX),
      corsOrigins: (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    database: { url: process.env.DATABASE_URL ?? '' },
    redis: {
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'project-portal:',
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? 'development-only-jwt-secret-change-me',
      issuer: process.env.JWT_ISSUER ?? 'project-portal-api',
      audience: process.env.JWT_AUDIENCE ?? 'project-portal-client',
      accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
      refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000),
      sessionAbsoluteTtlSeconds: Number(
        process.env.JWT_SESSION_ABSOLUTE_TTL_SECONDS ?? 7776000,
      ),
      passwordResetTtlSeconds: Number(
        process.env.PASSWORD_RESET_TTL_SECONDS ?? 1800,
      ),
      passwordResetUrl:
        process.env.PASSWORD_RESET_URL ??
        'http://localhost:3000/reset-password',
    },
    throttler: {
      ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 100),
    },
    mail: {
      host: process.env.SMTP_HOST ?? '127.0.0.1',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || undefined,
      password: process.env.SMTP_PASSWORD || undefined,
      from: process.env.MAIL_FROM ?? 'Project Portal <no-reply@example.com>',
      queueName: process.env.MAIL_QUEUE_NAME ?? 'mail',
      workerEnabled: process.env.MAIL_WORKER_ENABLED === 'true',
    },
  };
}
