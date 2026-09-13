import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  PaymentMethod,
  RejectReasonCategory,
} from '@ghaarfix/shared-types';

export const createBookingBodySchema = z.object({
  reservationId: objectIdSchema,
  paymentMethod: z.nativeEnum(PaymentMethod),
  customerNotes: z.string().trim().max(500).optional(),
  entitlementId: objectIdSchema.optional(),
  applyRewardCredit: z.boolean().optional(),
  promotionCode: z.string().trim().min(2).max(40).optional(),
});

export const confirmPaymentBodySchema = z.object({
  dev: z.boolean().optional(),
  razorpay_order_id: z.string().optional(),
  razorpay_payment_id: z.string().optional(),
  razorpay_signature: z.string().optional(),
});

export const cancelBookingBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const rejectBookingBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  category: z.nativeEnum(RejectReasonCategory).optional(),
});

export const rescheduleRequestBodySchema = z.object({
  proposedStartDateTime: z.string().datetime(),
  reason: z.string().trim().min(3).max(500),
});

export const rescheduleResponseBodySchema = z.object({
  accept: z.boolean(),
});

export const priceChangeRequestBodySchema = z.object({
  proposedAmount: z.number().min(0),
  reason: z.string().trim().min(3).max(500),
  items: z.array(z.string().trim().min(1)).max(20).optional(),
});

export const priceChangeResponseBodySchema = z.object({
  accept: z.boolean(),
});

export const paymentConfirmationBodySchema = z.object({
  role: z.enum(['CUSTOMER', 'PROVIDER']),
});

export const startServiceBodySchema = z.object({
  startOtp: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the 4-digit start code from the customer'),
});

export const completeServiceBodySchema = z.object({
  completionOtp: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the 4-digit completion code from the customer'),
});

export const adminBookingListQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  search: z.string().optional(),
  source: z.enum(['HOME_HELP', 'QUICK_SERVICES', 'URGENT_FIX', 'SLOT_RESERVATION']).optional(),
});

export const bookingListQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  tab: z.enum(['upcoming', 'past', 'completed', 'cancelled', 'requests', 'in_progress']).optional(),
});

export const findAnotherProviderBodySchema = z.object({
  providerId: objectIdSchema.optional(),
});

export const bookingIdParamSchema = z.object({ bookingId: objectIdSchema });

export const bookingMessageIdParamSchema = z.object({
  bookingId: objectIdSchema,
  messageId: objectIdSchema,
});

export const addBookingMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const bookingMessagesQuerySchema = paginationQuerySchema.extend({
  since: z.string().datetime().optional(),
});

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;
