import { env } from '../config/env';
import { logger } from '../utils/logger';
import { listUserEvents } from '../repositories/eventRepository';
import * as userContextRepository from '../repositories/userContextRepository';
import { generateUserContextFromEvents } from '../services/llmService';
import { getRedis } from '../config/redis';
import * as cache from '../services/cacheService';

export type ContextJobResult =
  | { status: 'completed'; persona: string; segment: string; confidence: number }
  | { status: 'skipped'; reason: string };

export async function processUserContext(
  tenantId: string,
  userId: string,
  priority: 'high_priority' | 'normal' | 'batch',
): Promise<ContextJobResult> {
  const events = await listUserEvents(tenantId, userId, 50);

  if (events.length < env.worker.minEventsForContext) {
    return { status: 'skipped', reason: 'insufficient_data' };
  }

  const last = await cache.getUserAggregation(tenantId, userId);
  const cooldown = priority === 'high_priority' ? 60_000 : env.worker.cooldownMs;
  if (last && Date.now() - last.timestamp < cooldown) {
    return { status: 'skipped', reason: 'cooldown' };
  }

  const context = await generateUserContextFromEvents(events);
  await userContextRepository.upsertUserContext(tenantId, userId, context);
  await cache.invalidateUserContextCache(tenantId, userId);
  await cache.cacheUserContext(tenantId, userId, context);
  await cache.setUserAggregation(tenantId, userId, { timestamp: Date.now(), context });

  await cache.publishContextUpdate({
    type: 'CONTEXT_UPDATED',
    tenant_id: tenantId,
    user_id: userId,
    data: {
      status: 'completed',
      persona: context.persona,
      segment: context.segment,
      confidence: context.confidence_score,
    },
    timestamp: new Date().toISOString(),
  });

  logger.info('User context generated', { tenantId, userId, segment: context.segment });
  return {
    status: 'completed',
    persona: context.persona,
    segment: context.segment,
    confidence: context.confidence_score,
  };
}

export async function withPerUserLock<T>(
  tenantId: string,
  userId: string,
  priority: 'high_priority' | 'normal' | 'batch',
  fn: () => Promise<T>,
): Promise<T | null> {
  const redis = await getRedis();
  const lockKey = `${tenantId}:${userId}`;
  const locked = await cache.acquireLock(redis, lockKey, 60);
  if (!locked && priority !== 'high_priority') {
    return null;
  }
  if (!locked && priority === 'high_priority') {
    return fn();
  }
  try {
    return await fn();
  } finally {
    await cache.releaseLock(redis, lockKey);
  }
}
