import request from 'supertest';
import { createApp } from '../src/app';
import { initializeDatabase, pool } from '../src/config/database';
import { getRedis } from '../src/config/redis';
import { initializePubSub } from '../src/services/pubsubService';
import { v4 as uuidv4 } from 'uuid';

const maybeDescribe = process.env.SKIP_INTEGRATION === 'true' ? describe.skip : describe;

maybeDescribe('API integration', () => {
  const tenant = 'integration-tenant';
  let ready = false;

  beforeAll(async () => {
    try {
      await initializeDatabase();
      await getRedis();
      await initializePubSub();
      await pool.query(`TRUNCATE events, user_contexts CASCADE`);
      ready = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Skipping integration tests (Postgres/Redis unavailable):', e);
      ready = false;
    }
  });

  test('POST /api/v1/events ingests and GET lists', async () => {
    if (!ready) return;
    const app = createApp();
    const userId = `user_${Date.now()}`;

    const r1 = await request(app)
      .post('/api/v1/events')
      .set('X-Tenant-ID', tenant)
      .send({
        user_id: userId,
        event_type: 'page_view',
        properties: { path: '/' },
      });

    expect(r1.status).toBe(202);
    expect(r1.body.event_id).toBeTruthy();

    const r2 = await request(app)
      .get(`/api/v1/users/${encodeURIComponent(userId)}/events`)
      .set('X-Tenant-ID', tenant);

    expect(r2.status).toBe(200);
    expect(r2.body.events.length).toBeGreaterThanOrEqual(1);
  });

  test('idempotent duplicate event_id', async () => {
    if (!ready) return;
    const app = createApp();
    const eventId = uuidv4();
    const body = {
      event_id: eventId,
      user_id: 'u-dup',
      event_type: 'login' as const,
      properties: {},
    };

    const a = await request(app).post('/api/v1/events').set('X-Tenant-ID', tenant).send(body);
    const b = await request(app).post('/api/v1/events').set('X-Tenant-ID', tenant).send(body);

    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(a.body.status).toBe('accepted');
    expect(b.body.status).toBe('duplicate');
  });

  test('cross-tenant event_id conflict returns 409', async () => {
    if (!ready) return;
    const app = createApp();
    const eventId = uuidv4();
    const body = {
      event_id: eventId,
      user_id: 'u-x',
      event_type: 'signup' as const,
      properties: {},
    };

    const a = await request(app).post('/api/v1/events').set('X-Tenant-ID', tenant).send(body);
    expect(a.status).toBe(202);

    const b = await request(app).post('/api/v1/events').set('X-Tenant-ID', `${tenant}-other`).send(body);
    expect(b.status).toBe(409);
  });
});
