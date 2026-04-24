import { pool } from '../src/config/database';
import { listUserEvents, countUserEvents } from '../src/repositories/eventRepository';

jest.mock('../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

describe('eventRepository pool queries', () => {
  test('listUserEvents maps properties', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          event_id: '00000000-0000-4000-8000-000000000011',
          event_type: 'purchase',
          timestamp: new Date(),
          properties: { amount: 12 },
          session_id: 's1',
        },
      ],
    });

    const rows = await listUserEvents('t', 'u', 10);
    expect(rows[0]?.properties.amount).toBe(12);
  });

  test('countUserEvents parses counts', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [{ c: '7' }] });
    const n = await countUserEvents('t', 'u');
    expect(n).toBe(7);
  });
});
