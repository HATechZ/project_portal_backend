import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { JsonRedisCacheCodec, RedisCacheCodec } from './redis-cache-codec';
import { REDIS_CLIENT, REDIS_DEFAULT_TTL_SECONDS } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly jsonCodec = new JsonRedisCacheCodec<unknown>();
  constructor(@Inject(REDIS_CLIENT) readonly client: Redis) {}

  async onModuleInit(): Promise<void> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.error(
        'Redis connection failed',
        error instanceof Error ? error.stack : String(error),
      );
      this.client.disconnect();
      throw error;
    }
  }

  async get<T>(
    key: string,
    codec: RedisCacheCodec<T> = this.jsonCodec as RedisCacheCodec<T>,
  ): Promise<T | null> {
    const value = await this.client.get(key);
    return value === null ? null : codec.decode(value);
  }
  async set<T>(
    key: string,
    value: T,
    ttlSeconds = REDIS_DEFAULT_TTL_SECONDS,
    codec: RedisCacheCodec<T> = this.jsonCodec as RedisCacheCodec<T>,
  ): Promise<void> {
    await this.client.set(key, codec.encode(value), 'EX', ttlSeconds);
  }
  async delete(...keys: string[]): Promise<number> {
    return keys.length === 0 ? 0 : this.client.del(...keys);
  }
  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = REDIS_DEFAULT_TTL_SECONDS,
    codec?: RedisCacheCodec<T>,
  ): Promise<T> {
    const cached = await this.get(key, codec);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds, codec);
    return value;
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
