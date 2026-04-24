process.env.NODE_ENV = 'test';
process.env.MOCK_PUBSUB = 'true';
process.env.USE_MOCK_VERTEX = 'true';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_NAME = process.env.DB_NAME ?? 'segment_context';
process.env.DB_USER = process.env.DB_USER ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'password';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.DEFAULT_TENANT_ID = 'test-tenant';

// Integration tests require local Postgres/Redis; keep them opt-in for fast CI/dev runs.
process.env.SKIP_INTEGRATION = process.env.SKIP_INTEGRATION ?? 'true';
