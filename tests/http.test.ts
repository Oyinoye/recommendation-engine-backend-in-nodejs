import request from 'supertest';
import { createApp } from '../src/app';
import { EventService } from '../src/services/eventService';

jest.mock('../src/services/eventService');

jest.mock('../src/repositories/eventRepository', () => ({
  listUserEvents: jest.fn().mockResolvedValue([
    {
      event_id: '00000000-0000-4000-8000-000000000099',
      event_type: 'page_view',
      timestamp: new Date(),
      properties: { path: '/' },
      session_id: null,
    },
  ]),
}));

const MockedEventService = EventService as unknown as jest.Mock;

describe('HTTP routes (mocked EventService)', () => {
  let ingestEvent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    ingestEvent = jest.fn().mockResolvedValue({ id: 'row-1', status: 'accepted' });

    MockedEventService.mockImplementation(
      () =>
        ({
          ingestEvent,
          getUserContextJson: jest.fn().mockResolvedValue({
            persona: 'Test',
            segment: 'Casual',
            confidence_score: 0.5,
            top_interests: ['x'],
            engagement_score: 5,
            churn_risk: 'Low',
            recommendations: ['r'],
            generated_at: new Date().toISOString(),
          }),
        }) as unknown as EventService,
    );
  });

  test('POST /api/v1/events rejects invalid payloads', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/events')
      .set('X-Tenant-ID', 'test-tenant')
      .send({ user_id: '', event_type: 'nope' });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/events', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/events')
      .set('X-Tenant-ID', 'test-tenant')
      .send({ user_id: 'u1', event_type: 'page_view', properties: { a: 1 } });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('accepted');
    expect(ingestEvent).toHaveBeenCalledTimes(1);
  });

  test('POST /api/v1/events/batch', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-Tenant-ID', 'test-tenant')
      .send({
        events: [
          { user_id: 'u1', event_type: 'login', properties: {} },
          { user_id: 'u1', event_type: 'signup', properties: {} },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body.total).toBe(2);
    expect(ingestEvent).toHaveBeenCalledTimes(2);
  });

  test('GET /api/v1/users/:id/context', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/users/u1/context').set('X-Tenant-ID', 'test-tenant');
    expect(res.status).toBe(200);
    expect(res.body.persona).toBe('Test');
  });

  test('GET /api/v1/users/:id/context 404', async () => {
    MockedEventService.mockImplementation(
      () =>
        ({
          ingestEvent,
          getUserContextJson: jest.fn().mockResolvedValue(null),
        }) as unknown as EventService,
    );
    const app = createApp();
    const res = await request(app).get('/api/v1/users/missing/context').set('X-Tenant-ID', 'test-tenant');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/users/:id/events proxies repository output', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/users/u1/events').set('X-Tenant-ID', 'test-tenant');
    // real DB may be empty; still expect shape
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
