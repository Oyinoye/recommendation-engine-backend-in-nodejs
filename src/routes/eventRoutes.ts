import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EventService } from '../services/eventService';
import { logger } from '../utils/logger';
import { batchSchema, ingestEventSchema } from '../validation/events';
import { getRedis } from '../config/redis';

export const eventRouter = Router();

eventRouter.post('/events', async (req, res, next) => {
  const started = Date.now();
  try {
    const parsed = ingestEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid body' });
      return;
    }

    const tenantId = req.tenantId!;
    let body = { ...parsed.data };
    if (!body.event_id) {
      body.event_id = uuidv4();
    }

    const svc = new EventService(tenantId);
    const result = await svc.ingestEvent(body);

    logger.info('Event ingested', {
      tenantId,
      event_id: body.event_id,
      status: result.status,
      ms: Date.now() - started,
    });

    res.status(202).json({
      id: result.id,
      status: result.status,
      event_id: body.event_id,
      message: result.status === 'duplicate' ? 'Duplicate event_id (idempotent)' : 'Event accepted for processing',
    });
  } catch (e) {
    next(e);
  }
});

eventRouter.post('/events/batch', async (req, res, next) => {
  const started = Date.now();
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid body' });
      return;
    }

    const tenantId = req.tenantId!;
    const svc = new EventService(tenantId);
    const batchSize = 25;
    const results: Array<{ status: 'accepted' | 'duplicate' }> = [];

    for (let i = 0; i < parsed.data.events.length; i += batchSize) {
      const chunk = parsed.data.events.slice(i, i + batchSize);
      const chunkOut = await Promise.all(
        chunk.map(async (ev) => {
          let e = { ...ev };
          if (!e.event_id) e.event_id = uuidv4();
          return svc.ingestEvent(e);
        }),
      );
      results.push(...chunkOut.map((r) => ({ status: r.status })));
    }

    res.status(202).json({
      total: results.length,
      accepted: results.filter((r) => r.status === 'accepted').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      processing_time_ms: Date.now() - started,
    });
  } catch (e) {
    next(e);
  }
});

eventRouter.get('/events/stream', async (req, res) => {
  const tenantId = req.tenantId!;
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');


  const redis = await getRedis();
  const subscriber = redis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe('realtime_events', (message) => {
    try {
      const event = JSON.parse(message) as { tenant_id?: string };
      if (event.tenant_id === tenantId) {
        res.write(`data: ${message}\n\n`);
      }
    } catch {
      // ignore malformed
    }
  });

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    res.end();
    void subscriber.unsubscribe('realtime_events').finally(() => subscriber.quit().catch(() => undefined));
  });
});
