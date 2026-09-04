import { z } from 'zod';
import { paginationQuerySchema } from '@ghaarfix/validation';
import {
  ChurnRiskLevel,
  LifecycleCampaignObjective,
  LifecycleCampaignStatus,
  MarketingChannel,
} from '@ghaarfix/shared-types';

export const consentBodySchema = z.object({
  marketingOptIn: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
});

export const redeemRewardBodySchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
});

export const recommendationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const lifecycleCampaignBodySchema = z.object({
  name: z.string().min(2).max(200),
  objective: z.nativeEnum(LifecycleCampaignObjective),
  audience: z.record(z.unknown()).optional(),
  trigger: z.string().min(1),
  channels: z.array(z.nativeEnum(MarketingChannel)).optional(),
  content: z.record(z.unknown()).optional(),
  frequencyPolicy: z.record(z.unknown()).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  status: z.nativeEnum(LifecycleCampaignStatus).optional(),
});

export const campaignIdParamSchema = z.object({
  id: z.string().min(1),
});

export const experimentIdParamSchema = z.object({
  id: z.string().min(1),
});

export const churnQuerySchema = paginationQuerySchema.extend({
  riskLevel: z.nativeEnum(ChurnRiskLevel).optional(),
});

export const campaignQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(LifecycleCampaignStatus).optional(),
});
