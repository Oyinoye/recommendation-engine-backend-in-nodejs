import type { RedisClientType } from 'redis';
import { getRedis } from '../config/redis';

export async function publishRealtimeEvent(payload: Record<string, unknown>): Promise<void> {
  const redis = await getRedis();
  await redis.publish('realtime_events', JSON.stringify(payload));
}

export async function publishContextUpdate(payload: Record<string, unknown>): Promise<void> {
  const redis = await getRedis();
  await redis.publish('context_updates', JSON.stringify(payload));
}

export async function cacheUserContext(tenantId: string, userId: string, context: unknown, ttlSec = 3600): Promise<void> {
  const redis = await getRedis();
  const key = `ctx:${tenantId}:${userId}`;
  await redis.set(key, JSON.stringify(context), { EX: ttlSec });
}

export async function getCachedUserContext(tenantId: string, userId: string): Promise<unknown | null> {
  const redis = await getRedis();
  const key = `ctx:${tenantId}:${userId}`;
  const v = await redis.get(key);
  return v ? JSON.parse(v) : null;
}

export async function invalidateUserContextCache(tenantId: string, userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`ctx:${tenantId}:${userId}`);
}

export async function acquireLock(redis: RedisClientType, resource: string, ttlSec = 60): Promise<boolean> {
  const key = `lock:${resource}`;
  const res = await redis.set(key, '1', { NX: true, EX: ttlSec });
  return res === 'OK';
}

export async function releaseLock(redis: RedisClientType, resource: string): Promise<void> {
  await redis.del(`lock:${resource}`);
}

export async function getUserAggregation(tenantId: string, userId: string): Promise<{ timestamp: number } | null> {
  const redis = await getRedis();
  const key = `agg:${tenantId}:${userId}`;
  const v = await redis.get(key);
  return v ? (JSON.parse(v) as { timestamp: number }) : null;
}

export async function setUserAggregation(tenantId: string, userId: string, data: unknown, ttlSec = 300): Promise<void> {
  const redis = await getRedis();
  const key = `agg:${tenantId}:${userId}`;
  await redis.set(key, JSON.stringify(data), { EX: ttlSec });
}
