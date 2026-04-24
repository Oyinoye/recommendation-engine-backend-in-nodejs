import { pool } from '../src/config/database';
import * as repo from '../src/repositories/userContextRepository';

jest.mock('../src/config/database', () => ({
  pool: { query: jest.fn() },
}));

describe('userContextRepository', () => {
  test('upsertUserContext executes insert sql', async () => {
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
    await repo.upsertUserContext('t', 'u', {
      persona: 'p',
      segment: 's',
      confidence_score: 0.1,
      top_interests: [],
      engagement_score: 1,
      churn_risk: 'Low',
      recommendations: [],
      generated_at: new Date().toISOString(),
    });
    expect(pool.query).toHaveBeenCalled();
  });

  test('getLatestUserContext returns parsed json', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          context_data: {
            persona: 'p',
            segment: 's',
            confidence_score: 0.2,
            top_interests: ['a'],
            engagement_score: 2,
            churn_risk: 'Medium',
            recommendations: ['r'],
            generated_at: new Date().toISOString(),
          },
        },
      ],
    });
    const ctx = await repo.getLatestUserContext('t', 'u');
    expect(ctx?.persona).toBe('p');
  });
});
