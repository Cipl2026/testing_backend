import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { captureError } from '@/modules/reliability/error-monitoring.service.js';
import { AppError } from '@/utils/AppError.js';
import { sendError } from '@/utils/apiResponse.js';
import { logger } from '@/utils/logger.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, ErrorCode.NOT_FOUND),
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      void captureError(err, { errorCode: err.code, requestId, traceId: req.traceId });
    }
    sendError(res, err.message, err.code, err.statusCode, requestId);
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => issue.message).join(', ');
    sendError(res, message, ErrorCode.VALIDATION_ERROR, 400, requestId);
    return;
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    sendError(res, err.message, ErrorCode.VALIDATION_ERROR, 400, requestId);
    return;
  }

  if (err instanceof Error && err.name === 'MongoServerError') {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
      let message = 'Resource already exists.';
      if ('phone' in keyValue) {
        message = 'An account already exists with this phone number.';
      } else if ('providerId' in keyValue && 'serviceId' in keyValue) {
        message = 'You already offer this service.';
      } else if ('providerId' in keyValue && 'name' in keyValue) {
        message = 'Service area with this name already exists.';
      } else if ('userId' in keyValue) {
        message = 'Profile already exists for this account.';
      }
      sendError(res, message, ErrorCode.CONFLICT, 409, requestId);
      return;
    }
    void captureError(err, { errorCode: ErrorCode.DATABASE_ERROR, requestId, traceId: req.traceId });
    sendError(
      res,
      env.isProd ? 'A database error occurred.' : err.message,
      ErrorCode.DATABASE_ERROR,
      500,
      requestId,
    );
    return;
  }

  logger.error('Unhandled error', {
    error: err,
    requestId,
    traceId: req.traceId,
    errorCode: ErrorCode.INTERNAL_ERROR,
  });

  void captureError(err, { errorCode: ErrorCode.INTERNAL_ERROR, requestId, traceId: req.traceId });

  const message = env.isProd
    ? 'Internal server error.'
    : err instanceof Error
      ? err.message
      : 'Internal server error.';

  sendError(res, message, ErrorCode.INTERNAL_ERROR, 500, requestId);
}
