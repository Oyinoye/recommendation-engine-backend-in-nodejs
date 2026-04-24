import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { env } from './config/env';
import { tenantMiddleware } from './middleware/tenant';
import { apiRateLimiter } from './middleware/rateLimit';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { eventRouter } from './routes/eventRoutes';
import { userRouter } from './routes/userRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();
  const allowedOrigins = env.frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const compressionFilter: compression.CompressionFilter = (req, res) => {
    if (req.path.endsWith('/events/stream')) {
      return false;
    }

    return compression.filter(req, res);
  };

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // In local development, allow any browser origin to avoid SSE/CORS
        // breakage when opening the UI via localhost or LAN hostnames.
        if (env.nodeEnv !== 'production') {
          callback(null, true);
          return;
        }

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(compression({ filter: compressionFilter }));
  app.use(express.json({ limit: '10mb' }));
  app.use(metricsMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'segment-context-api', timestamp: new Date().toISOString() });
  });

  app.get('/metrics', (req, res, next) => {
    void metricsHandler(req, res).catch(next);
  });

  app.use(tenantMiddleware);
  app.use(apiRateLimiter);

  // Versioned API (spec)
  app.use('/api/v1', eventRouter);
  app.use('/api/v1/users', userRouter);

  // Convenience aliases for common front-end paths
  app.use('/api', eventRouter);
  app.use('/api/users', userRouter);

  app.use(errorHandler);
  return app;
}
