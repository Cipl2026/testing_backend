import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';

export const settlementIdParamSchema = z.object({
  settlementId: objectIdSchema,
});

export const settleProviderRecordBodySchema = z.object({
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const adminSettlementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'SETTLED', 'CANCELLED']).optional(),
  kind: z.enum(['PAYOUT_TO_PROVIDER', 'COMMISSION_FROM_PROVIDER']).optional(),
  providerId: objectIdSchema.optional(),
});

export const providerSettlementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'SETTLED', 'CANCELLED']).optional(),
});
