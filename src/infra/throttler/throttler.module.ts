import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule as NestThrottlerModule,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { AppConfiguration } from '../../config/configuration';
import { RedisModule } from '../redis/redis.module';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [
    RedisModule,
    NestThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) => [
        {
          ttl: config.get('throttler.ttlMs', { infer: true }),
          limit: config.get('throttler.limit', { infer: true }),
        },
      ],
    }),
  ],
  providers: [
    RedisThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: RedisThrottlerStorage },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerModule {}
