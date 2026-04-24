import { createClient, type RedisClientType } from 'redis';
import { env } from './env';
import { logger, serializeError } from '../utils/logger';

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (client && client.isOpen) return client;
  client = createClient({
    socket: { host: env.redis.host, port: env.redis.port },
    password: env.redis.password,
  });
  client.on('error', (err) => logger.error('Redis error', { error: serializeError(err) }));
  await client.connect();
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}
