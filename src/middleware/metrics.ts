import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

let httpRequests: client.Counter<'method' | 'route' | 'status'> | null = null;

if (process.env.NODE_ENV !== 'test') {
  client.collectDefaultMetrics();
  httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!httpRequests) {
    next();
    return;
  }
  res.on('finish', () => {
    const route = (req.route?.path as string | undefined) ?? req.path;
    httpRequests!.inc({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    res.type('text/plain').send('');
    return;
  }
  res.setHeader('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}
