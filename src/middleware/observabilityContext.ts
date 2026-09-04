import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { runWithObservabilityContext } from '@/modules/reliability/observability/context-store.js';
import { hashUserId } from '@/modules/reliability/observability/provider.js';
import { logger } from '@/utils/logger.js';

export function observabilityContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const traceId = req.traceId ?? req.requestId ?? 'unknown';
  const requestId = req.requestId ?? traceId;

  const ctx: {
    requestId: string;
    traceId: string;
    userIdHash?: string;
    userType?: string;
  } = { requestId, traceId };

  if (req.auth?.userId) {
    ctx.userIdHash = hashUserId(req.auth.userId);
    ctx.userType = req.auth.role ?? UserRole.CUSTOMER;
  }

  runWithObservabilityContext(ctx, () => {
    res.on('finish', () => {
      logger.info('Request completed', {
        requestId,
        traceId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: res.locals.durationMs,
      });
    });
    next();
  });
}
