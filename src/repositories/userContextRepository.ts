import { pool } from '../config/database';

export type UserContextRecord = {
  persona: string;
  segment: string;
  confidence_score: number;
  top_interests: string[];
  engagement_score: number;
  churn_risk: string;
  recommendations: string[];
  behavioral_traits?: Record<string, unknown>;
  generated_at: string;
};

export async function upsertUserContext(
  tenantId: string,
  userId: string,
  context: UserContextRecord,
): Promise<void> {
  await pool.query(
    `INSERT INTO user_contexts (tenant_id, user_id, persona, segment, confidence_score, context_data, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (tenant_id, user_id)
     DO UPDATE SET
       persona = EXCLUDED.persona,
       segment = EXCLUDED.segment,
       confidence_score = EXCLUDED.confidence_score,
       context_data = EXCLUDED.context_data,
       generated_at = NOW()`,
    [tenantId, userId, context.persona, context.segment, context.confidence_score, JSON.stringify(context)],
  );
}

export async function getLatestUserContext(
  tenantId: string,
  userId: string,
): Promise<UserContextRecord | null> {
  const res = await pool.query<{ context_data: UserContextRecord }>(
    `SELECT context_data FROM user_contexts WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
    [tenantId, userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return row.context_data;
}
