import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const CURSOR_VERSION = 'v1';
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

export interface CursorPayload {
  v: string;
  sortField: string;
  sortValue: string | number;
  id: string;
}

function cursorSecret(): string {
  return env.jwt.accessSecret;
}

export function clampPageLimit(limit?: number): number {
  const parsed = limit ?? DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

export function encodeCursor(payload: CursorPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', cursorSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function decodeCursor(cursor: string): CursorPayload {
  const [body, sig] = cursor.split('.');
  if (!body || !sig) {
    throw new AppError('Invalid cursor.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const expected = createHmac('sha256', cursorSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new AppError('Invalid cursor signature.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CursorPayload;
  if (payload.v !== CURSOR_VERSION) {
    throw new AppError('Unsupported cursor version.', 400, ErrorCode.VALIDATION_ERROR);
  }
  return payload;
}

export function buildCursorFromDoc(
  doc: { _id: { toString(): string } },
  sortField: string,
  sortValue: string | number,
): string {
  return encodeCursor({
    v: CURSOR_VERSION,
    sortField,
    sortValue,
    id: doc._id.toString(),
  });
}

export function buildCursorQuery(
  cursor: string | undefined,
  sortField: string,
): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  const payload = decodeCursor(cursor);
  if (payload.sortField !== sortField) {
    throw new AppError('Cursor sort field mismatch.', 400, ErrorCode.VALIDATION_ERROR);
  }
  return {
    $or: [
      { [sortField]: { $lt: payload.sortValue } },
      { [sortField]: payload.sortValue, _id: { $lt: payload.id } },
    ],
  };
}

export const PAGE_LIMITS = { DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT };
