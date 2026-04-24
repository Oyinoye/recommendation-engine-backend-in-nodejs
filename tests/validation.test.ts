import { batchSchema, ingestEventSchema } from '../src/validation/events';

describe('validation', () => {
  test('ingestEventSchema accepts minimal payload', () => {
    const parsed = ingestEventSchema.safeParse({
      user_id: 'u1',
      event_type: 'page_view',
    });
    expect(parsed.success).toBe(true);
  });

  test('batchSchema enforces max size', () => {
    const events = Array.from({ length: 1001 }).map(() => ({
      user_id: 'u',
      event_type: 'login' as const,
    }));
    const parsed = batchSchema.safeParse({ events });
    expect(parsed.success).toBe(false);
  });
});
