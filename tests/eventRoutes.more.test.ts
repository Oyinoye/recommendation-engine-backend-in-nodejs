import request from 'supertest';
import { createApp } from '../src/app';
import { EventService } from '../src/services/eventService';

jest.mock('../src/services/eventService');

const MockedEventService = EventService as unknown as jest.Mock;

describe('eventRoutes (more)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedEventService.mockImplementation(
      () =>
        ({
          ingestEvent: jest.fn().mockResolvedValue({ id: '1', status: 'accepted' }),
        }) as unknown as EventService,
    );
  });

  test('POST /api/v1/events/batch rejects invalid payload', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-Tenant-ID', 'test-tenant')
      .send({ events: [] });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/events propagates errors', async () => {
    MockedEventService.mockImplementation(
      () =>
        ({
          ingestEvent: jest.fn().mockRejectedValue(new Error('db down')),
        }) as unknown as EventService,
    );
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/events')
      .set('X-Tenant-ID', 'test-tenant')
      .send({ user_id: 'u1', event_type: 'page_view', properties: {} });

    expect(res.status).toBe(500);
  });
});
