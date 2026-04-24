import { env } from './config/env';
import { initializeDatabase, pool } from './config/database';
import { closeRedis, getRedis } from './config/redis';
import { initializePubSub } from './services/pubsubService';
import { startContextWorker } from './workers/contextWorker';
import { logger, serializeError } from './utils/logger';

async function main(): Promise<void> {
  await initializeDatabase();
  await getRedis();
  await initializePubSub();

  const stop = await startContextWorker();
  logger.info('Context worker running', { project: env.gcp.projectId, subscription: env.gcp.pubsubSubscription });

  const shutdown = async () => {
    logger.info('Worker shutting down...');
    await stop().catch((e) => logger.warn('stop worker failed', { error: serializeError(e) }));
    await pool.end().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main().catch((e) => {
  logger.error('Worker fatal error', { error: serializeError(e) });
  process.exit(1);
});
