import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { IndexRecommendationStatus } from '@ghaarfix/shared-types';

export const indexReviewBodySchema = z.object({
  status: z.nativeEnum(IndexRecommendationStatus),
});

export const loadTestIdParamSchema = z.object({
  id: objectIdSchema,
});

export const slowQueryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  collection: z.string().optional(),
});
