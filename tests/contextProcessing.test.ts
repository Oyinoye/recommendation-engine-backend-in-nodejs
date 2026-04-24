import { v4 as uuidv4 } from 'uuid';
import * as eventRepo from '../src/repositories/eventRepository';
import * as userContextRepo from '../src/repositories/userContextRepository';
import * as cache from '../src/services/cacheService';
import { processUserContext } from '../src/workers/contextProcessing';
import type { DbEventRow } from '../src/repositories/eventRepository';

describe('contextProcessing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('skips when insufficient events', async () => {
    jest.spyOn(eventRepo, 'listUserEvents').mockResolvedValue([]);
    const res = await processUserContext('t1', 'u1', 'normal');
    expect(res.status).toBe('skipped');
    expect(res).toMatchObject({ reason: 'insufficient_data' });
  });

  test('generates and persists context', async () => {
    jest.spyOn(cache, 'getUserAggregation').mockResolvedValue(null);
    const events: DbEventRow[] = Array.from({ length: 10 }).map((_, i) => ({
      event_id: uuidv4(),
      event_type: i % 3 === 0 ? 'purchase' : 'page_view',
      timestamp: new Date(Date.now() - i * 60_000),
      properties: i % 3 === 0 ? { amount: 10 } : { path: '/' },
      session_id: null,
    }));
    jest.spyOn(eventRepo, 'listUserEvents').mockResolvedValue(events);

    const upsert = jest.spyOn(userContextRepo, 'upsertUserContext').mockResolvedValue(undefined as never);
    jest.spyOn(cache, 'invalidateUserContextCache').mockResolvedValue(undefined as never);
    jest.spyOn(cache, 'cacheUserContext').mockResolvedValue(undefined as never);
    jest.spyOn(cache, 'setUserAggregation').mockResolvedValue(undefined as never);
    jest.spyOn(cache, 'publishContextUpdate').mockResolvedValue(undefined as never);

    const res = await processUserContext('t1', 'u1', 'normal');
    expect(res.status).toBe('completed');
    expect(upsert).toHaveBeenCalled();
  });
});
