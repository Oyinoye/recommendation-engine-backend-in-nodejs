import { Pool, type PoolClient } from 'pg';
import { env } from './env';
import { logger, serializeError } from '../utils/logger';

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: env.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5000,
});

const schemaSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_user_time
  ON events (tenant_id, user_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_user
  ON events (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS user_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  persona TEXT,
  segment VARCHAR(100),
  confidence_score DOUBLE PRECISION,
  context_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_contexts_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contexts_tenant_user
  ON user_contexts (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS processing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  worker_id VARCHAR(255) NOT NULL DEFAULT 'context-worker',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_processing_audit UNIQUE (event_id, worker_id)
);
`;

export async function initializeDatabase(): Promise<void> {
  try {
    await pool.query(schemaSql);
    logger.info('Database schema ensured');
  } catch (e) {
    logger.error('Database initialization failed', { error: serializeError(e) });
    throw e;
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
