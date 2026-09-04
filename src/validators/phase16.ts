import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import {
  AlertFeedbackType,
  DeviceAssetLinkRelationship,
  IoTProviderType,
} from '@ghaarfix/shared-types';

export const connectionIdParamSchema = z.object({ id: objectIdSchema });
export const deviceIdParamSchema = z.object({ id: objectIdSchema });
export const providerParamSchema = z.object({
  provider: z.nativeEnum(IoTProviderType),
});
export const connectionDiscoverParamSchema = z.object({ connectionId: objectIdSchema });

export const connectProviderBodySchema = z.object({
  homeId: objectIdSchema.optional(),
  redirectUrl: z.string().url().optional(),
});

export const approveDeviceBodySchema = z.object({
  homeId: objectIdSchema,
});

export const linkDeviceBodySchema = z.object({
  assetId: objectIdSchema,
  relationshipType: z.nativeEnum(DeviceAssetLinkRelationship),
});

export const alertFeedbackBodySchema = z.object({
  feedback: z.nativeEnum(AlertFeedbackType),
});

export const insightsQuerySchema = z.object({
  homeId: objectIdSchema,
});

export const createRuleTemplateBodySchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  conditions: z.record(z.unknown()),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.unknown()).optional() })),
  version: z.number().int().positive().optional(),
});
