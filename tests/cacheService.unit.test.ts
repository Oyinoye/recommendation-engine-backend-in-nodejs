import type { RedisClientType } from 'redis';
import * as cache from '../src/services/cacheService';
import * as redis from '../src/config/redis';

jest.mock('../src/config/redis', () => ({
  getRedis: jest.fn(),
}));

describe('cacheService', () => {
  const redisMock = {
    publish: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  } as unknown as RedisClientType;

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.getRedis as jest.Mock).mockResolvedValue(redisMock);
  });

  test('publishRealtimeEvent publishes json', async () => {
    await cache.publishRealtimeEvent({ a: 1 });
    expect(redisMock.publish).toHaveBeenCalled();
  });

  test('cacheUserContext sets key with ttl', async () => {
    await cache.cacheUserContext('t', 'u', { ok: true }, 10);
    expect(redisMock.set).toHaveBeenCalled();
  });

  test('acquireLock returns boolean', async () => {
    (redisMock as unknown as { set: jest.Mock }).set.mockResolvedValueOnce('OK');
    const acquired = await cache.acquireLock(redisMock as never, 'r', 5);
    expect(acquired).toBe(true);
  });
});
