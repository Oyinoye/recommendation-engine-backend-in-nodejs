import type { PoolClient } from 'pg';
import { insertEvent } from '../src/repositories/eventRepository';

describe('eventRepository.insertEvent', () => {
  test('returns inserted=true when insert returns a row', async () => {
    const client = {
      query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] }),
    } as unknown as PoolClient;

    const out = await insertEvent(client, {
      eventId: '00000000-0000-4000-8000-000000000003',
      tenantId: 'tenant-a',
      userId: 'u1',
      eventType: 'page_view',
      timestamp: new Date(),
      properties: {},
    });

    expect(out.inserted).toBe(true);
    expect(out.rowId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  test('throws TENANT_MISMATCH when event_id exists for another tenant', async () => {
    const client = {
      query: jest
        .fn()
        // INSERT ... DO NOTHING returns no row
        .mockResolvedValueOnce({ rows: [] })
        // duplicate lookup
        .mockResolvedValueOnce({ rows: [{ id: '11111111-1111-4111-8111-111111111111', tenant_id: 'tenant-a' }] }),
    } as unknown as PoolClient;

    await expect(
      insertEvent(client, {
        eventId: '00000000-0000-4000-8000-000000000001',
        tenantId: 'tenant-b',
        userId: 'u1',
        eventType: 'page_view',
        timestamp: new Date(),
        properties: {},
      }),
    ).rejects.toMatchObject({ code: 'TENANT_MISMATCH' });
  });

  test('returns inserted=false when duplicate matches tenant', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: '22222222-2222-4222-8222-222222222222', tenant_id: 'tenant-a' }] }),
    } as unknown as PoolClient;

    const out = await insertEvent(client, {
      eventId: '00000000-0000-4000-8000-000000000002',
      tenantId: 'tenant-a',
      userId: 'u1',
      eventType: 'page_view',
      timestamp: new Date(),
      properties: {},
    });

    expect(out.inserted).toBe(false);
    expect(out.rowId).toBe('22222222-2222-4222-8222-222222222222');
  });
});
