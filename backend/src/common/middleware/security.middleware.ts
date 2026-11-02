import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../constants';

/** Gives every request an id. It is returned in the X-Request-Id header and in every error body. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/**
 * Extra protection against cross-site request forgery for cookie-based login:
 * browsers always send an Origin header on cross-site POST/PUT/PATCH/DELETE requests,
 * so anything that does not come from our own frontend is rejected.
 */
export function originCheck(allowedOrigins: string[]) {
  const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (!unsafeMethods.has(req.method) || !origin || allowedOrigins.includes(origin)) {
      next();
      return;
    }
    res.status(403).json({
      statusCode: 403,
      code: ErrorCode.CSRF_BLOCKED,
      message: 'This request was blocked for your safety.',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'],
    });
  };
}
