import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { AssetCondition, HomeType, RoomType, WarrantyType } from '@ghaarfix/shared-types';

export const homeIdParamSchema = z.object({ homeId: objectIdSchema });
export const assetIdParamSchema = z.object({ assetId: objectIdSchema });
export const roomIdParamSchema = z.object({ roomId: objectIdSchema });
export const warrantyIdParamSchema = z.object({ warrantyId: objectIdSchema });
export const scheduleIdParamSchema = z.object({ scheduleId: objectIdSchema });
export const providerIdParamSchema = z.object({ providerId: objectIdSchema });
export const bookingIdParamSchema = z.object({ bookingId: objectIdSchema });

export const createHomeBodySchema = z.object({
  addressId: objectIdSchema,
  name: z.string().min(1).max(100),
  homeType: z.nativeEnum(HomeType).optional(),
  isPrimary: z.boolean().optional(),
});

export const updateHomeBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  homeType: z.nativeEnum(HomeType).optional(),
  isPrimary: z.boolean().optional(),
});

export const createRoomBodySchema = z.object({
  name: z.string().min(1).max(100),
  roomType: z.nativeEnum(RoomType).optional(),
  floor: z.string().optional(),
});

export const createAssetBodySchema = z.object({
  assetTypeId: objectIdSchema,
  name: z.string().min(1).max(120),
  roomId: objectIdSchema.optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.number().min(0).optional(),
  installedAt: z.string().datetime().optional(),
  condition: z.nativeEnum(AssetCondition).optional(),
});

export const updateAssetBodySchema = createAssetBodySchema.partial().omit({ assetTypeId: true });

export const createWarrantyBodySchema = z.object({
  provider: z.string().min(1),
  warrantyType: z.nativeEnum(WarrantyType).optional(),
  startDate: z.string(),
  endDate: z.string(),
  coverage: z.string().optional(),
  notes: z.string().optional(),
});

export const snoozeBodySchema = z.object({
  days: z.number().int().positive().default(7),
});

export const skipMaintenanceBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const assetTypeBodySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
  categoryId: objectIdSchema.optional(),
  description: z.string().optional(),
  displayOrder: z.number().optional(),
});

export const maintenanceTemplateBodySchema = z.object({
  assetTypeId: objectIdSchema,
  serviceId: objectIdSchema,
  title: z.string().min(1),
  intervalDays: z.number().int().positive(),
  priority: z.string().optional(),
  description: z.string().optional(),
});

export const reservationAssetBodySchema = z.object({
  assetId: objectIdSchema.optional(),
  homeId: objectIdSchema.optional(),
});
