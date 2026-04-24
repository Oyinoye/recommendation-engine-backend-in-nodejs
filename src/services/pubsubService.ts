import { PubSub, type Topic } from '@google-cloud/pubsub';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let topic: Topic | null = null;
let pubsubClient: PubSub | null = null;

export async function initializePubSub(): Promise<void> {
  if (env.mockPubSub) {
    logger.warn('Pub/Sub mocked (MOCK_PUBSUB=true); messages are not published');
    return;
  }

  pubsubClient = new PubSub({
    projectId: env.gcp.projectId,
    ...(env.gcp.keyFile ? { keyFilename: env.gcp.keyFile } : {}),
  });

  const t = pubsubClient.topic(env.gcp.pubsubTopic);
  const [exists] = await t.exists();
  if (!exists) {
    await t.create();
    logger.info('Created Pub/Sub topic', { topic: env.gcp.pubsubTopic });
  }

  const sub = t.subscription(env.gcp.pubsubSubscription);
  const [subExists] = await sub.exists();
  if (!subExists) {
    await t.createSubscription(env.gcp.pubsubSubscription, {
      ackDeadlineSeconds: 60,
      retryPolicy: {
        minimumBackoff: { seconds: 10 },
        maximumBackoff: { seconds: 600 },
      },
    });
    logger.info('Created Pub/Sub subscription', { subscription: env.gcp.pubsubSubscription });
  }

  topic = t;
  logger.info('Pub/Sub ready', { topic: env.gcp.pubsubTopic });
}

export async function publishUserEventMessage(payload: Record<string, unknown>): Promise<string | null> {
  if (env.mockPubSub || !topic) {
    logger.debug('Skipping Pub/Sub publish (mock or uninitialized)', { payload });
    return null;
  }
  const messageId = await topic.publishMessage({ json: payload });
  return messageId;
}
