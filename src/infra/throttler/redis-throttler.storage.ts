import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../redis/redis.service';
import { THROTTLER_REDIS_PREFIX } from './throttler.constants';

const incrementScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blocked = 0
local blockTtl = 0
if redis.call('EXISTS', KEYS[2]) == 1 then
  blocked = 1
  blockTtl = redis.call('PTTL', KEYS[2])
elseif current > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = 1
  blockTtl = tonumber(ARGV[3])
end
return {current, ttl, blocked, blockTtl}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const baseKey = `${THROTTLER_REDIS_PREFIX}:${throttlerName}:${key}`;
    const result = (await this.redis.client.eval(
      incrementScript,
      2,
      baseKey,
      `${baseKey}:blocked`,
      ttl,
      limit,
      blockDuration || ttl,
    )) as number[];
    return {
      totalHits: Number(result[0]),
      timeToExpire: Math.max(0, Number(result[1])),
      isBlocked: Number(result[2]) === 1,
      timeToBlockExpire: Math.max(0, Number(result[3])),
    };
  }
}
