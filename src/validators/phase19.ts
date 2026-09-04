import { z } from 'zod';
import { paginationQuerySchema } from '@ghaarfix/validation';
import {
  FinancialAdjustmentType,
  FinancialAlertSeverity,
  FinancialAlertStatus,
  FinancialEventStatus,
  FinancialEventType,
  FinancialSourceType,
  ReconciliationStatus,
} from '@ghaarfix/shared-types';

export const ledgerQuerySchema = paginationQuerySchema.extend({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  eventType: z.nativeEnum(FinancialEventType).optional(),
  sourceType: z.nativeEnum(FinancialSourceType).optional(),
  bookingId: z.string().optional(),
  providerId: z.string().optional(),
  customerId: z.string().optional(),
  cityId: z.string().optional(),
  zoneId: z.string().optional(),
  serviceId: z.string().optional(),
  status: z.nativeEnum(FinancialEventStatus).optional(),
});

export const reconciliationQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['payment', 'payout']).optional(),
  status: z.nativeEnum(ReconciliationStatus).optional(),
});

export const alertsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(FinancialAlertStatus).optional(),
  severity: z.nativeEnum(FinancialAlertSeverity).optional(),
});

export const adjustmentBodySchema = z.object({
  type: z.nativeEnum(FinancialAdjustmentType),
  amountMinor: z.number().int().positive(),
  reason: z.string().min(3).max(500),
  bookingId: z.string().optional(),
  providerId: z.string().optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const bookingIdFinanceParamSchema = z.object({
  bookingId: z.string().min(1),
});

export const alertIdParamSchema = z.object({
  id: z.string().min(1),
});

export const approvalIdParamSchema = z.object({
  id: z.string().min(1),
});
