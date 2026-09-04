import { z } from 'zod';
import { ConsentStatus, ConsentType, StepUpMethod } from '@ghaarfix/shared-types';

export const consentUpdateSchema = z.object({
  consents: z.record(z.nativeEnum(ConsentType), z.nativeEnum(ConsentStatus)),
});

export const stepUpInitSchema = z.object({
  action: z.string().min(3).max(100),
  method: z.nativeEnum(StepUpMethod).optional(),
});

export const stepUpVerifySchema = z.object({
  stepUpId: z.string().min(1),
  mpin: z.string().min(4).max(8),
});

export const deletionRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const sessionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const exportIdParamSchema = z.object({
  id: z.string().min(1),
});

export const roleBodySchema = z.object({
  key: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default([]),
});

export const roleUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
});

export const threatModelBodySchema = z.object({
  asset: z.string().min(2),
  threat: z.string().min(2),
  attackVector: z.string().min(2),
  impact: z.string().min(2),
  likelihood: z.string().min(2),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  mitigation: z.string().min(2),
  status: z.enum(['OPEN', 'MITIGATED', 'ACCEPTED', 'CLOSED']).optional(),
  owner: z.string().optional(),
});

export const findingUpdateSchema = z.object({
  status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'ACCEPTED_RISK', 'RESOLVED']).optional(),
  owner: z.string().optional(),
});

export const roleKeyParamSchema = z.object({
  key: z.string().min(1),
});

export const findingIdParamSchema = z.object({
  id: z.string().min(1),
});
