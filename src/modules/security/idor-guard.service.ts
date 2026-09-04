import mongoose from 'mongoose';
import { recordIdorAttempt } from '@/modules/security/security-event.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export function assertObjectId(id: string, label = 'id'): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}.`, 400, ErrorCode.VALIDATION_ERROR);
  }
}

export function sanitizeMongoQuery<T extends Record<string, unknown>>(query: T): T {
  const sanitized = { ...query };
  for (const key of Object.keys(sanitized)) {
    if (key.startsWith('$')) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export async function assertResourceOwner(
  actorId: string,
  ownerId: string | undefined,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  if (!ownerId || ownerId !== actorId) {
    await recordIdorAttempt(actorId, resourceType, resourceId);
    throw new AppError('You do not have access to this resource.', 403, ErrorCode.FORBIDDEN);
  }
}

export function pickAllowedFields<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
  allowed: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of allowed) {
    if (body[key as string] !== undefined) {
      result[key] = body[key as string] as T[keyof T];
    }
  }
  return result;
}
