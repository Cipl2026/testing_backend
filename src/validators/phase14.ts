import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { IntelligenceFeature, IntelligenceFeedbackType } from '@ghaarfix/shared-types';

export const analysisIdParamSchema = z.object({ id: objectIdSchema });

export const analyzeIssueBodySchema = z.object({
  description: z.string().trim().min(5).max(2000),
  homeId: objectIdSchema.optional(),
  imageFileKey: z.string().trim().optional(),
});

export const submitFeedbackBodySchema = z.object({
  feature: z.nativeEnum(IntelligenceFeature),
  userFeedback: z.nativeEnum(IntelligenceFeedbackType),
  wasCorrect: z.boolean().optional(),
  correctedValue: z.string().optional(),
});

export const assistantMessageBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: objectIdSchema.optional(),
});

export const confirmActionBodySchema = z.object({
  conversationId: objectIdSchema,
  actionType: z.string(),
  confirmed: z.boolean(),
  bookingId: objectIdSchema.optional(),
});

export const knowledgeSourceBodySchema = z.object({
  type: z.enum(['FAQ', 'POLICY', 'SERVICE_DOCUMENT', 'APPROVED_HELP_CONTENT']),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(100),
});

export const knowledgeChunkBodySchema = z.object({
  content: z.string().trim().min(10).max(10000),
});

export const providerDiagnosisFeedbackSchema = z.object({
  analysisId: objectIdSchema,
  wasCorrect: z.boolean(),
  correctedCategory: z.string().optional(),
  actualDiagnosis: z.string().optional(),
});
