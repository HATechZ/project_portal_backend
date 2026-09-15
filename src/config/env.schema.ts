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
  DATABASE_URL_PRIVILEGED: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://127.0.0.1:6379'),
  REDIS_KEY_PREFIX: Joi.string().default('project-portal:'),
  JWT_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('development-only-jwt-secret-change-me'),
    }),
  JWT_ISSUER: Joi.string().default('project-portal-api'),
  JWT_AUDIENCE: Joi.string().default('project-portal-client'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().min(300).default(2592000),
  JWT_SESSION_ABSOLUTE_TTL_SECONDS: Joi.number()
    .integer()
    .min(Joi.ref('JWT_REFRESH_TTL_SECONDS'))
    .default(7776000),
  PASSWORD_RESET_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(3600)
    .default(1800),
  PASSWORD_RESET_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/reset-password'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  SMTP_HOST: Joi.string().hostname().default('127.0.0.1'),
  SMTP_PORT: Joi.number().port().default(1025),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().empty('').optional(),
  SMTP_PASSWORD: Joi.string().empty('').optional(),
  MAIL_FROM: Joi.string().default('Project Portal <no-reply@example.com>'),
  MAIL_QUEUE_NAME: Joi.string().default('mail'),
  MAIL_WORKER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  MESSAGING_RELAY_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  MESSAGING_RELAY_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
  MESSAGING_RELAY_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100),
  MESSAGING_TRANSPORT: Joi.string()
    .valid('in-process', 'rabbitmq')
    .default('in-process'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .default('amqp://portal:portal@127.0.0.1:5672'),
})
  .and('SMTP_USER', 'SMTP_PASSWORD')
  .unknown(true);
