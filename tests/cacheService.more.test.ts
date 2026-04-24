import * as cache from '../src/services/cacheService';
import * as redis from '../src/config/redis';

jest.mock('../src/config/redis', () => ({
  getRedis: jest.fn(),
}));

describe('cacheService (more)', () => {
  const redisMock = {
    publish: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(JSON.stringify({ ok: true })),
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.getRedis as jest.Mock).mockResolvedValue(redisMock);
  });

  test('publishContextUpdate', async () => {
    await cache.publishContextUpdate({ a: 1 });
    expect(redisMock.publish).toHaveBeenCalled();
  });

  test('getCachedUserContext parses json', async () => {
    const v = await cache.getCachedUserContext('t', 'u');
    expect(v).toEqual({ ok: true });
  });

  test('invalidateUserContextCache deletes key', async () => {
    await cache.invalidateUserContextCache('t', 'u');
    expect(redisMock.del).toHaveBeenCalled();
  });

  test('setUserAggregation and getUserAggregation', async () => {
    (redisMock.get as jest.Mock).mockResolvedValueOnce(JSON.stringify({ timestamp: 1 }));
    const agg = await cache.getUserAggregation('t', 'u');
    expect(agg?.timestamp).toBe(1);
    await cache.setUserAggregation('t', 'u', { timestamp: 2 }, 10);
    expect(redisMock.set).toHaveBeenCalled();
  });

  test('releaseLock deletes lock key', async () => {
    await cache.releaseLock(redisMock as never, 'resource');
    expect(redisMock.del).toHaveBeenCalled();
  });
});
