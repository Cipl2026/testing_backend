import { z } from 'zod';
import {
  ConfidenceLevel,
  IssueUrgency,
  type IssueClassificationResult,
  type ImageClassificationResult,
} from '@ghaarfix/shared-types';

export const issueClassificationResultSchema = z.object({
  category: z.string().min(1),
  categoryId: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.nativeEnum(ConfidenceLevel),
  urgency: z.nativeEnum(IssueUrgency),
  riskFlags: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
  explanation: z.string(),
  safetyEscalation: z.boolean().optional(),
  safetyMessage: z.string().optional(),
});

export const imageClassificationResultSchema = z.object({
  detectedIssues: z.array(z.string()),
  applianceType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.nativeEnum(ConfidenceLevel),
  explanation: z.string(),
  requiresHumanReview: z.boolean(),
});

export function validateIssueClassification(data: unknown): IssueClassificationResult {
  return issueClassificationResultSchema.parse(data);
}

export function validateImageClassification(data: unknown): ImageClassificationResult {
  return imageClassificationResultSchema.parse(data);
}
