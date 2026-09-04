import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

const TRANSIENT_CODES = new Set([
  ErrorCode.DEPENDENCY_FAILURE,
  ErrorCode.TIMEOUT,
  ErrorCode.DATABASE_ERROR,
  ErrorCode.QUEUE_ERROR,
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
]);

export function isTransientError(error: unknown): boolean {
  if (error instanceof AppError) {
    return TRANSIENT_CODES.has(error.code);
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && TRANSIENT_CODES.has(code)) return true;
    return /timeout|econnreset|temporarily unavailable/i.test(error.message);
  }
  return false;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export async function retryTransient<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 5000;
  const jitter = opts.jitter ?? true;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === maxAttempts) {
        metricsService.counter('retry_exhausted_total', 1);
        throw error;
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const wait = jitter ? delay + Math.floor(Math.random() * delay * 0.2) : delay;
      metricsService.counter('retry_attempt_total', 1, { attempt: String(attempt) });
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}
