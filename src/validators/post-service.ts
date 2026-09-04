import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  ReviewCategory,
  ReviewStatus,
  ServiceEvidenceType,
  SupportTicketCategory,
  SupportTicketStatus,
} from '@ghaarfix/shared-types';

export const bookingIdParamSchema = z.object({
  bookingId: objectIdSchema,
});

export const locationUpdateBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().optional(),
  recordedAt: z.string().datetime().optional(),
});

export const evidenceUploadBodySchema = z.object({
  type: z.nativeEnum(ServiceEvidenceType),
  caption: z.string().max(500).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const completionSummaryBodySchema = z.object({
  summary: z.string().min(3).max(2000),
  parts: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().min(0),
        amount: z.number().min(0),
      }),
    )
    .optional(),
  recommendations: z.string().max(1000).optional(),
  checklist: z.object({
    serviceCompleted: z.boolean(),
    workAreaCleaned: z.boolean(),
    customerInformed: z.boolean(),
    photosAttached: z.boolean(),
  }),
});

export const createReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  categories: z
    .array(
      z.object({
        category: z.nativeEnum(ReviewCategory),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .optional(),
});

export const updateReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

export const reviewIdParamSchema = z.object({
  reviewId: objectIdSchema,
});

export const invoiceIdParamSchema = z.object({
  invoiceId: objectIdSchema,
});

export const providerIdParamSchema = z.object({
  providerId: objectIdSchema,
});

export const createSupportTicketBodySchema = z.object({
  category: z.nativeEnum(SupportTicketCategory),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  attachments: z.array(z.string()).optional(),
});

export const createGeneralSupportTicketBodySchema = z.object({
  category: z.nativeEnum(SupportTicketCategory).optional(),
  subject: z.string().min(3).max(200).optional(),
  description: z.string().min(3).max(5000),
});

export const addSupportMessageBodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const ticketIdParamSchema = z.object({
  ticketId: objectIdSchema,
});

export const adminTicketUpdateBodySchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  resolution: z.string().max(2000).optional(),
  internalNote: z.string().max(2000).optional(),
  reply: z.string().min(1).max(5000).optional(),
  reason: z.string().min(3),
});

export const reviewModerationBodySchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  reason: z.string().min(3),
});

export const adminListTicketsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
});

export const adminListReviewsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
});

export const fileKeyParamSchema = z.object({
  fileKey: z.string().min(1),
});
