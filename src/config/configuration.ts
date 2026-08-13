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
    throttler: {
      ttlMs: Number(process.env.THROTTLE_TTL_MS ?? 60000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 100),
    },
    mail: {
      host: process.env.SMTP_HOST ?? 'localhost',
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
