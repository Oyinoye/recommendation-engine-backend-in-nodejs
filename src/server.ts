import { createApp } from './app';
import { env } from './config/env';
import { initializeDatabase, pool } from './config/database';
import { closeRedis, getRedis } from './config/redis';
import { initializePubSub } from './services/pubsubService';
import { logger, serializeError } from './utils/logger';

async function shutdown(): Promise<void> {
  try {
    await pool.end();
  } catch (e) {
    logger.warn('Pool end failed', { error: serializeError(e) });
  }
  try {
    await closeRedis();
  } catch (e) {
    logger.warn('Redis close failed', { error: serializeError(e) });
  }
}

async function main(): Promise<void> {
  await initializeDatabase();
  await getRedis();
  await initializePubSub();

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
  });

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const sig of signals) {
    process.on(sig, () => {
      logger.info(`Received ${sig}, shutting down...`);
      server.close(() => {
        void shutdown().finally(() => process.exit(0));
      });
    });
  }
}

void main().catch((e) => {
  logger.error('Fatal startup error', { error: serializeError(e) });
  process.exit(1);
});
