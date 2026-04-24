import type { PoolClient } from 'pg';
import { pool } from '../config/database';

export type DbEventRow = {
  event_id: string;
  event_type: string;
  timestamp: Date;
  properties: Record<string, unknown>;
  session_id: string | null;
};

export async function insertEvent(
  client: PoolClient,
  input: {
    eventId: string;
    tenantId: string;
    userId: string;
    eventType: string;
    timestamp: Date;
    properties: Record<string, unknown>;
    sessionId?: string | null;
  },
): Promise<{ inserted: boolean; rowId: string | null }> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO events (event_id, tenant_id, user_id, event_type, "timestamp", properties, session_id)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id::text`,
    [
      input.eventId,
      input.tenantId,
      input.userId,
      input.eventType,
      input.timestamp,
      JSON.stringify(input.properties ?? {}),
      input.sessionId ?? null,
    ],
  );

  if (res.rows[0]?.id) {
    return { inserted: true, rowId: res.rows[0].id };
  }

  const dup = await client.query<{ id: string; tenant_id: string }>(
    `SELECT id::text, tenant_id FROM events WHERE event_id = $1::uuid LIMIT 1`,
    [input.eventId],
  );
  const row = dup.rows[0];
  if (!row) {
    return { inserted: false, rowId: null };
  }
  if (row.tenant_id !== input.tenantId) {
    const err = new Error('event_id already ingested for a different tenant');
    (err as NodeJS.ErrnoException).code = 'TENANT_MISMATCH';
    throw err;
  }
  return { inserted: false, rowId: row.id };
}

export async function listUserEvents(tenantId: string, userId: string, limit = 50): Promise<DbEventRow[]> {
  const res = await pool.query<DbEventRow>(
    `SELECT event_id, event_type, "timestamp", properties, session_id
     FROM events
     WHERE tenant_id = $1 AND user_id = $2
     ORDER BY "timestamp" DESC
     LIMIT $3`,
    [tenantId, userId, limit],
  );
  return res.rows.map((r: DbEventRow) => ({
    ...r,
    properties: (r.properties as Record<string, unknown>) ?? {},
  }));
}

export async function countUserEvents(tenantId: string, userId: string): Promise<number> {
  const res = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM events WHERE tenant_id = $1 AND user_id = $2`,
    [tenantId, userId],
  );
  return Number(res.rows[0]?.c ?? 0);
}
