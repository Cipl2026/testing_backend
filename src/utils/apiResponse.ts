import type { Response } from 'express';
import type { ApiErrorResponse, ApiSuccessResponse } from '@ghaarfix/shared-types';

export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200,
  meta: Record<string, unknown> | null = null,
): void {
  const body: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode = 500,
  requestId?: string,
): void {
  const body: ApiErrorResponse = {
    success: false,
    code,
    message,
    data: null,
    ...(requestId ? { requestId } : {}),
  };
  res.status(statusCode).json(body);
}
