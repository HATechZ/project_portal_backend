import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { JsonRedisCacheCodec, RedisCacheCodec } from './redis-cache-codec';
import { REDIS_CLIENT, REDIS_DEFAULT_TTL_SECONDS } from './redis.constants';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly jsonCodec = new JsonRedisCacheCodec<unknown>();
  constructor(@Inject(REDIS_CLIENT) readonly client: Redis) {}

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
    if (this.client.status !== 'end') await this.client.quit();
  }
}
