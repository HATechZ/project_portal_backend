import Joi from 'joi';
import { EnvironmentVariables, NODE_ENV_VALUES } from './env';

export const environmentSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid(...NODE_ENV_VALUES)
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().default('api'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://127.0.0.1:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('project-portal:'),
  SESSION_SECRET: Joi.string().min(16).default('change-this-session-secret'),
  SESSION_MAX_AGE_MS: Joi.number().integer().min(60000).default(86400000),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  SMTP_HOST: Joi.string().hostname().default('127.0.0.1'),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().default('Project Portal <no-reply@example.com>'),
  MAIL_QUEUE_NAME: Joi.string().default('mail'),
  MAIL_WORKER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
}).unknown(true);
