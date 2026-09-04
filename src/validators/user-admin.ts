import { z } from 'zod';
import { ProviderStatus } from '@ghaarfix/shared-types';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';

export const adminCustomersListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']).optional(),
});

export const adminProvidersListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z.nativeEnum(ProviderStatus).optional(),
});

export const adminUserIdParamSchema = z.object({
  userId: objectIdSchema,
});

export const adminProviderIdParamSchema = z.object({
  providerId: objectIdSchema,
});

export const adminUpdateCustomerStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']),
  reason: z.string().trim().min(3).max(500),
});

export const adminUpdateProviderStatusBodySchema = z.object({
  status: z.nativeEnum(ProviderStatus),
  reason: z.string().trim().min(3).max(500),
});
