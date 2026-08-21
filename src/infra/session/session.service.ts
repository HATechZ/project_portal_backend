import {
  Injectable,
  INestApplication,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { createClient, RedisClientType } from 'redis';
import { AppConfiguration } from '../../config/configuration';
import { SESSION_COOKIE_NAME } from './session.constants';

@Injectable()
export class SessionService implements OnModuleInit, OnApplicationShutdown {
  private readonly client: RedisClientType;
  private readonly store: RedisStore;

  constructor(private readonly config: ConfigService<AppConfiguration, true>) {
    this.client = createClient({
      url: this.config.get('redis.url', { infer: true }),
    });
    this.store = new RedisStore({
      client: this.client,
      prefix: `${this.config.get('redis.keyPrefix', { infer: true })}session:`,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  configure(app: INestApplication): void {
    const isProduction =
      this.config.get('app.env', { infer: true }) === 'production';
    app.use(
      session({
        store: this.store,
        secret: this.config.get('session.secret', { infer: true }),
        name: SESSION_COOKIE_NAME,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: this.config.get('session.maxAgeMs', { infer: true }),
        },
      }),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}
