export const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENV_VALUES)[number];

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  REDIS_KEY_PREFIX: string;
  SESSION_SECRET: string;
  SESSION_MAX_AGE_MS: number;
  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  MAIL_FROM: string;
  MAIL_QUEUE_NAME: string;
  MAIL_WORKER_ENABLED: boolean;
}

export const env = {
  nodeEnv: 'NODE_ENV',
  port: 'PORT',
  apiPrefix: 'API_PREFIX',
  corsOrigins: 'CORS_ORIGINS',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  redisKeyPrefix: 'REDIS_KEY_PREFIX',
  sessionSecret: 'SESSION_SECRET',
  sessionMaxAgeMs: 'SESSION_MAX_AGE_MS',
  throttleTtlMs: 'THROTTLE_TTL_MS',
  throttleLimit: 'THROTTLE_LIMIT',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpSecure: 'SMTP_SECURE',
  smtpUser: 'SMTP_USER',
  smtpPassword: 'SMTP_PASSWORD',
  mailFrom: 'MAIL_FROM',
  mailQueueName: 'MAIL_QUEUE_NAME',
  mailWorkerEnabled: 'MAIL_WORKER_ENABLED',
} as const satisfies Record<string, keyof EnvironmentVariables>;
