import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import {
  ClaimResolutionType,
  ProtectionClaimStatus,
  ProtectionClaimType,
  RevisitReason,
  ServiceCertificationLevel,
  ImprovementPlanStatus,
  QualityInspectionResult,
} from '@ghaarfix/shared-types';

export const bookingIdParamSchema = z.object({ bookingId: objectIdSchema });
export const claimIdParamSchema = z.object({ id: objectIdSchema });
export const partIdParamSchema = z.object({ id: objectIdSchema });
export const providerTrustParamSchema = z.object({ providerId: objectIdSchema });
export const policyIdParamSchema = z.object({ id: objectIdSchema });
export const inspectionIdParamSchema = z.object({ id: objectIdSchema });

export const createClaimBodySchema = z.object({
  type: z.nativeEnum(ProtectionClaimType),
  description: z.string().min(10).max(2000),
  requestedResolution: z.nativeEnum(ClaimResolutionType).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export const claimEvidenceBodySchema = z.object({
  fileKey: z.string(),
  fileUrl: z.string(),
  mimeType: z.string(),
});

export const revisitBodySchema = z.object({
  reason: z.nativeEnum(RevisitReason).optional(),
  claimId: objectIdSchema.optional(),
  preferOriginalProvider: z.boolean().optional(),
});

export const partApprovalBodySchema = z.object({
  partName: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
  reason: z.string().min(5),
  warrantyDays: z.number().int().optional(),
  evidenceFileKey: z.string().optional(),
});

export const checklistBodySchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      completed: z.boolean(),
      value: z.string().optional(),
    }),
  ),
});

export const claimResponseBodySchema = z.object({
  response: z.string().min(5).max(2000),
});

export const updateClaimBodySchema = z.object({
  status: z.nativeEnum(ProtectionClaimStatus),
  resolution: z.nativeEnum(ClaimResolutionType).optional(),
  resolutionNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const guaranteePolicyBodySchema = z.object({
  serviceId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  coverageDays: z.number().int().min(1).max(365).optional(),
  coveredIssueTypes: z.array(z.nativeEnum(ProtectionClaimType)).optional(),
  exclusions: z.array(z.string()).optional(),
  maxClaims: z.number().int().min(1).optional(),
  resolutionOptions: z.array(z.nativeEnum(ClaimResolutionType)).optional(),
});

export const improvementPlanBodySchema = z.object({
  issues: z.array(z.string()),
  actions: z.array(z.string()),
  deadline: z.string().datetime(),
  reviewNotes: z.string().optional(),
});

export const certificationBodySchema = z.object({
  providerId: objectIdSchema,
  serviceId: objectIdSchema,
  level: z.nativeEnum(ServiceCertificationLevel),
  expiresAt: z.string().datetime().optional(),
  requirements: z.array(z.string()).optional(),
});

export const inspectionBodySchema = z.object({
  bookingId: objectIdSchema,
  providerId: objectIdSchema,
  trigger: z.string(),
});

export const completeInspectionBodySchema = z.object({
  checklist: z.array(
    z.object({ label: z.string(), passed: z.boolean(), notes: z.string().optional() }),
  ),
  result: z.nativeEnum(QualityInspectionResult),
  evidence: z.array(z.string()).optional(),
});

export const refundBodySchema = z.object({
  amount: z.number().min(0),
  idempotencyKey: z.string(),
});

export const trustQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const improvementPlanStatusBodySchema = z.object({
  status: z.nativeEnum(ImprovementPlanStatus),
  reviewNotes: z.string().optional(),
});
