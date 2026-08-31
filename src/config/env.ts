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
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_SECONDS: number;
  JWT_SESSION_ABSOLUTE_TTL_SECONDS: number;
  PASSWORD_RESET_TTL_SECONDS: number;
  PASSWORD_RESET_URL: string;
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
  MESSAGING_RELAY_ENABLED: boolean;
  MESSAGING_RELAY_INTERVAL_MS: number;
  MESSAGING_RELAY_BATCH_SIZE: number;
  MESSAGING_TRANSPORT: 'in-process' | 'rabbitmq';
  RABBITMQ_URL: string;
}

export const env = {
  nodeEnv: 'NODE_ENV',
  port: 'PORT',
  apiPrefix: 'API_PREFIX',
  corsOrigins: 'CORS_ORIGINS',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  redisKeyPrefix: 'REDIS_KEY_PREFIX',
  jwtSecret: 'JWT_SECRET',
  jwtIssuer: 'JWT_ISSUER',
  jwtAudience: 'JWT_AUDIENCE',
  jwtAccessTtlSeconds: 'JWT_ACCESS_TTL_SECONDS',
  jwtRefreshTtlSeconds: 'JWT_REFRESH_TTL_SECONDS',
  jwtSessionAbsoluteTtlSeconds: 'JWT_SESSION_ABSOLUTE_TTL_SECONDS',
  passwordResetTtlSeconds: 'PASSWORD_RESET_TTL_SECONDS',
  passwordResetUrl: 'PASSWORD_RESET_URL',
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
  messagingRelayEnabled: 'MESSAGING_RELAY_ENABLED',
  messagingRelayIntervalMs: 'MESSAGING_RELAY_INTERVAL_MS',
  messagingRelayBatchSize: 'MESSAGING_RELAY_BATCH_SIZE',
  messagingTransport: 'MESSAGING_TRANSPORT',
  rabbitmqUrl: 'RABBITMQ_URL',
} as const satisfies Record<string, keyof EnvironmentVariables>;
