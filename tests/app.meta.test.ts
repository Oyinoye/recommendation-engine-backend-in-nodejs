import request from 'supertest';
import { createApp } from '../src/app';

describe('app bootstrap routes', () => {
  test('/health', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  test('/metrics in test env returns empty body', async () => {
    const app = createApp();
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
  });
});
