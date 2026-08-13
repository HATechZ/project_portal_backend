import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfiguration } from '../../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        new Redis(config.get('redis.url', { infer: true }), {
          keyPrefix: config.get('redis.keyPrefix', { infer: true }),
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
