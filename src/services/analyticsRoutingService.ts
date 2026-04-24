import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Bonus hook: route raw analytical payloads to BigQuery in production by wiring
 * a Pub/Sub → Dataflow/BQ export or direct insert client here.
 */
export async function routeRawEventToBigQuery(payload: Record<string, unknown>): Promise<void> {
  if (!env.bigQueryDataset) return;
  logger.debug('BigQuery routing enabled (stub)', { dataset: env.bigQueryDataset, event_id: payload.event_id });
}
