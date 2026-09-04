import type { RequestHandler } from 'express';

/** Pass-through middleware — rate limiting disabled */
export const noopMiddleware: RequestHandler = (_req, _res, next) => next();
