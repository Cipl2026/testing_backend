import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,64}$/;

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    traceId?: string;
  }
}

export function sanitizeRequestId(value?: string): string {
  if (!value) return randomUUID();
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 64) return randomUUID();
  if (!REQUEST_ID_PATTERN.test(trimmed)) return randomUUID();
  return trimmed;
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const header = req.header('x-request-id');
  const requestId = sanitizeRequestId(header ?? undefined);
  req.requestId = requestId;
  req.traceId = req.header('x-trace-id')?.trim() || requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-trace-id', req.traceId);
  next();
};
