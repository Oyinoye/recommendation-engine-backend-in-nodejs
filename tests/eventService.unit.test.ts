import { EventService } from '../src/services/eventService';
import * as db from '../src/config/database';
import * as eventRepo from '../src/repositories/eventRepository';
import * as pubsub from '../src/services/pubsubService';
import * as cache from '../src/services/cacheService';
import * as analytics from '../src/services/analyticsRoutingService';
import * as userCtx from '../src/repositories/userContextRepository';

jest.mock('../src/config/database');
jest.mock('../src/repositories/eventRepository');
jest.mock('../src/services/pubsubService');
jest.mock('../src/services/cacheService');
jest.mock('../src/services/analyticsRoutingService');
jest.mock('../src/repositories/userContextRepository');

describe('EventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.withTransaction as jest.Mock).mockImplementation(async (fn: (c: unknown) => Promise<unknown>) => {
      return fn({});
    });
  });

  test('ingestEvent publishes side effects on insert', async () => {
    (eventRepo.insertEvent as jest.Mock).mockResolvedValue({ inserted: true, rowId: 'rid-1' });
    (pubsub.publishUserEventMessage as jest.Mock).mockResolvedValue('mid');
    (cache.publishRealtimeEvent as jest.Mock).mockResolvedValue(undefined);
    (analytics.routeRawEventToBigQuery as jest.Mock).mockResolvedValue(undefined);

    const svc = new EventService('t1');
    const out = await svc.ingestEvent({
      event_id: '00000000-0000-4000-8000-0000000000aa',
      user_id: 'u1',
      event_type: 'page_view',
      timestamp: new Date(),
      properties: { x: 1 },
    });

    expect(out.status).toBe('accepted');
    expect(pubsub.publishUserEventMessage).toHaveBeenCalled();
    expect(cache.publishRealtimeEvent).toHaveBeenCalled();
  });

  test('ingestEvent duplicate short-circuits side effects', async () => {
    (eventRepo.insertEvent as jest.Mock).mockResolvedValue({ inserted: false, rowId: 'rid-1' });
    const svc = new EventService('t1');
    const out = await svc.ingestEvent({
      event_id: '00000000-0000-4000-8000-0000000000bb',
      user_id: 'u1',
      event_type: 'login',
      timestamp: new Date(),
      properties: {},
    });
    expect(out.status).toBe('duplicate');
    expect(pubsub.publishUserEventMessage).not.toHaveBeenCalled();
    expect(cache.publishRealtimeEvent).not.toHaveBeenCalled();
  });

  test('getUserContextJson uses DB on cache miss', async () => {
    (cache.getCachedUserContext as jest.Mock).mockResolvedValue(null);
    (userCtx.getLatestUserContext as jest.Mock).mockResolvedValue({
      persona: 'P',
      segment: 'Casual',
      confidence_score: 0.4,
      top_interests: ['a'],
      engagement_score: 1,
      churn_risk: 'Low',
      recommendations: [],
      generated_at: new Date().toISOString(),
    });
    (cache.cacheUserContext as jest.Mock).mockResolvedValue(undefined);

    const svc = new EventService('t1');
    const ctx = await svc.getUserContextJson('u1');
    expect(ctx?.persona).toBe('P');
    expect(cache.cacheUserContext).toHaveBeenCalled();
  });
});
