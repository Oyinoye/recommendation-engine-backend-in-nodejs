import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const e = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled error', { message: e.message, stack: e.stack, path: req.path });

  const code = (e as NodeJS.ErrnoException).code;
  if (code === 'TENANT_MISMATCH') {
    res.status(409).json({ error: e.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
