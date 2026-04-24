import type { Request, Response, NextFunction } from 'express';
import { tenantMiddleware } from '../src/middleware/tenant';
import { errorHandler } from '../src/middleware/errorHandler';

describe('middlewares', () => {
  test('tenantMiddleware sets default tenant in non-production', () => {
    const req = { header: () => undefined, query: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;
    tenantMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as { tenantId?: string }).tenantId).toBeTruthy();
  });

  test('errorHandler maps TENANT_MISMATCH to 409', () => {
    const req = { path: '/x' } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const err = Object.assign(new Error('bad'), { code: 'TENANT_MISMATCH' });
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('errorHandler defaults to 500', () => {
    const req = { path: '/x' } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    errorHandler(new Error('boom'), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
