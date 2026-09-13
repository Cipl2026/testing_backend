import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import { HomeCarouselActionType, HomeCarouselBannerStyle, HomeCarouselPlacement } from '@/models/HomeCarouselItem.js';

const imageUrlSchema = z
  .string()
  .trim()
  .min(1, 'Image is required')
  .refine(
    (value) =>
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/api/'),
    'Image must be a valid URL or uploaded file path',
  );

export const homeCarouselIdParamSchema = z.object({ id: objectIdSchema });

export const homeCarouselBodySchema = z.object({
  placement: z.nativeEnum(HomeCarouselPlacement),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(240).optional(),
  imageUrl: imageUrlSchema,
  actionType: z.nativeEnum(HomeCarouselActionType).optional(),
  actionValue: z.string().trim().max(500).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  bannerStyle: z.nativeEnum(HomeCarouselBannerStyle).optional(),
  badgeText: z.string().trim().max(40).optional(),
  ctaText: z.string().trim().max(40).optional(),
  gradientStart: z.string().trim().max(20).optional(),
  gradientEnd: z.string().trim().max(20).optional(),
});

export const homeCarouselUpdateBodySchema = homeCarouselBodySchema.partial();
