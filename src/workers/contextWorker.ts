import { PubSub } from '@google-cloud/pubsub';
import type { Message } from '@google-cloud/pubsub';
import { env } from '../config/env';
import { logger, serializeError } from '../utils/logger';
import { processUserContext, withPerUserLock } from './contextProcessing';

type PubSubPayload = {
  tenant_id?: string;
  user_id?: string;
  priority?: string;
};

export async function startContextWorker(): Promise<() => Promise<void>> {
  if (env.mockPubSub) {
    logger.warn('Context worker not subscribing because MOCK_PUBSUB=true');
    return async () => {};
  }

  const pubsub = new PubSub({
    projectId: env.gcp.projectId,
    ...(env.gcp.keyFile ? { keyFilename: env.gcp.keyFile } : {}),
  });

  const subscription = pubsub.subscription(env.gcp.pubsubSubscription, {
    flowControl: { maxMessages: Math.max(1, env.worker.concurrency) * 2, allowExcessMessages: false },
  });

  const onMessage = async (message: Message) => {
    let acked = false;
    try {
      const data = JSON.parse(message.data.toString()) as PubSubPayload;
      const tenantId = data.tenant_id;
      const userId = data.user_id;
      const priority: 'high_priority' | 'normal' | 'batch' =
        data.priority === 'high_priority' ? 'high_priority' : 'normal';
      if (!tenantId || !userId) {
        message.ack();
        acked = true;
        return;
      }

      const result = await withPerUserLock(tenantId, userId, priority, async () =>
        processUserContext(tenantId, userId, priority),
      );

      if (result === null) {
        logger.debug('Skipped due to lock contention', { tenantId, userId });
      }

      message.ack();
      acked = true;
    } catch (e) {
      logger.error('Worker message failed', {
        error: serializeError(e),
        deliveryAttempt: message.deliveryAttempt,
      });
      const attempt = message.deliveryAttempt ?? 1;
      if (!acked && attempt < 5) {
        message.nack();
      } else if (!acked) {
        message.ack();
      }
    }
  };

  subscription.on('message', (m) => {
    void onMessage(m);
  });
  subscription.on('error', (err) =>
    logger.error('Pub/Sub subscription error', { error: serializeError(err) }),
  );

  logger.info('Context worker subscribed', { subscription: env.gcp.pubsubSubscription });
  return async () => {
    await subscription.close();
  };
}
