import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerTenant = req.header('x-tenant-id')?.trim();
  const queryTenant = typeof req.query.tenant_id === 'string' ? req.query.tenant_id.trim() : undefined;
  const tenantId = headerTenant || queryTenant;

  if (tenantId) {
    req.tenantId = tenantId;
    next();
    return;
  }

  if (env.nodeEnv !== 'production') {
    req.tenantId = env.defaultTenantId;
    next();
    return;
  }

  res.status(401).json({ error: 'Tenant ID required (X-Tenant-ID header or tenant_id query parameter)' });
}
