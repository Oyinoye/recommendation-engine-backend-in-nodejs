import { v4 as uuidv4 } from 'uuid';
import { pool, initializeDatabase } from '../config/database';
import { env } from '../config/env';
import { logger, serializeError } from '../utils/logger';

async function main(): Promise<void> {
  await initializeDatabase();

  const tenantId = process.env.SEED_TENANT_ID ?? env.defaultTenantId;
  const userId = process.env.SEED_USER_ID ?? 'seed_user';

  await pool.query(`DELETE FROM events WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
  await pool.query(`DELETE FROM user_contexts WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);

  const types = ['page_view', 'button_click', 'purchase', 'signup', 'login'] as const;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const now = Date.now();
    for (let i = 0; i < 60; i += 1) {
      const eventType = types[i % types.length]!;
      const amount = eventType === 'purchase' ? { amount: 25 + (i % 5) * 10, sku: `SKU-${i}` } : { path: `/p/${i}` };
      await client.query(
        `INSERT INTO events (event_id, tenant_id, user_id, event_type, "timestamp", properties)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
        [uuidv4(), tenantId, userId, eventType, new Date(now - i * 60_000), JSON.stringify(amount)],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  logger.info('Seed complete', { tenantId, userId, events: 60 });
  await pool.end();
}

void main().catch((e) => {
  logger.error('Seed failed', { error: serializeError(e) });
  process.exit(1);
});
