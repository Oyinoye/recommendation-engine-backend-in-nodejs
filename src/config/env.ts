import dotenv from 'dotenv';

dotenv.config();

const num = (v: string | undefined, fallback: number) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 3000),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: num(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME ?? 'segment_context',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    poolMax: num(process.env.DB_POOL_MAX, 20),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: num(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  gcp: {
    projectId: process.env.GCP_PROJECT_ID ?? 'test-project',
    keyFile: process.env.GCP_KEY_FILE || undefined,
    region: process.env.GCP_REGION ?? 'us-central1',
    pubsubTopic: process.env.PUBSUB_TOPIC ?? 'user-events',
    pubsubSubscription: process.env.PUBSUB_SUBSCRIPTION ?? 'user-events-sub',
    pubsubEmulatorHost: process.env.PUBSUB_EMULATOR_HOST || undefined,
    vertexLocation: process.env.VERTEX_LOCATION ?? 'us-central1',
    vertexModel: process.env.VERTEX_MODEL ?? 'gemini-1.5-flash-001',
  },

  worker: {
    concurrency: num(process.env.WORKER_CONCURRENCY, 5),
    cooldownMs: num(process.env.WORKER_COOLDOWN_MS, 300_000),
    minEventsForContext: num(process.env.WORKER_MIN_EVENTS, 5),
  },

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: num(process.env.RATE_LIMIT_MAX_REQUESTS, 500),
  },

  defaultTenantId: process.env.DEFAULT_TENANT_ID ?? 'dev-tenant',
  mockPubSub: process.env.MOCK_PUBSUB === 'true',
  mockVertex: process.env.USE_MOCK_VERTEX !== 'false',
  bigQueryDataset: process.env.BIGQUERY_DATASET || undefined,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
};
