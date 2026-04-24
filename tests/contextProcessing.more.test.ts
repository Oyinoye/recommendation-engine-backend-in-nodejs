import { v4 as uuidv4 } from 'uuid';
import * as eventRepo from '../src/repositories/eventRepository';
import * as cache from '../src/services/cacheService';
import { processUserContext, withPerUserLock } from '../src/workers/contextProcessing';
import type { DbEventRow } from '../src/repositories/eventRepository';

describe('contextProcessing edge cases', () => {
  afterEach(() => jest.restoreAllMocks());

  test('skips when cooldown active', async () => {
    jest.spyOn(cache, 'getUserAggregation').mockResolvedValue({ timestamp: Date.now() });
    const events: DbEventRow[] = Array.from({ length: 10 }).map(() => ({
      event_id: uuidv4(),
      event_type: 'page_view',
      timestamp: new Date(),
      properties: {},
      session_id: null,
    }));
    jest.spyOn(eventRepo, 'listUserEvents').mockResolvedValue(events);

    const res = await processUserContext('t1', 'u1', 'normal');
    expect(res).toMatchObject({ status: 'skipped', reason: 'cooldown' });
  });

  test('withPerUserLock returns null when lock not acquired', async () => {
    jest.spyOn(cache, 'acquireLock').mockResolvedValue(false);
    const out = await withPerUserLock('t', 'u', 'normal', async () => 'x');
    expect(out).toBeNull();
  });

  test('withPerUserLock runs without lock for high priority when lock busy', async () => {
    jest.spyOn(cache, 'acquireLock').mockResolvedValue(false);
    const out = await withPerUserLock('t', 'u', 'high_priority', async () => 'ok');
    expect(out).toBe('ok');
  });
});
