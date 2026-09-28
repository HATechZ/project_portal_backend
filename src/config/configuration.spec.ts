import configuration from './configuration';

describe('Redis configuration', () => {
  const originalCacheRedisUrl = process.env.CACHE_REDIS_URL;
  const originalQueueRedisUrl = process.env.QUEUE_REDIS_URL;

  afterEach(() => {
    restore('CACHE_REDIS_URL', originalCacheRedisUrl);
    restore('QUEUE_REDIS_URL', originalQueueRedisUrl);
  });

  it('uses independent local defaults for cache and queue Redis', () => {
    delete process.env.CACHE_REDIS_URL;
    delete process.env.QUEUE_REDIS_URL;

    const redis = configuration().redis;
    expect(redis.cache.url).toBe('redis://127.0.0.1:6379');
    expect(redis.cache.keyPrefix).toBe('project-portal:');
    expect(redis.queue.url).toBe('redis://127.0.0.1:6380');
  });

  it('keeps explicitly configured cache and queue URLs isolated', () => {
    process.env.CACHE_REDIS_URL = 'redis://cache.example:6379';
    process.env.QUEUE_REDIS_URL = 'redis://queue.example:6380';

    expect(configuration().redis).toMatchObject({
      cache: { url: 'redis://cache.example:6379' },
      queue: { url: 'redis://queue.example:6380' },
    });
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
