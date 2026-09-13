import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  adminDeleteAppVersion,
  adminListAppVersions,
  adminUpsertAppVersion,
} from '@/modules/app-updates/app-version.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  app: z.enum(['customer', 'provider']).optional(),
});

const upsertBodySchema = z
  .object({
    app: z.enum(['customer', 'provider']),
    platform: z.enum(['ios', 'android']),
    latestVersion: z.string().min(1),
    minimumSupportedVersion: z.string().min(1),
    latestBuildNumber: z.coerce.number().int().positive().optional(),
    minimumBuildNumber: z.coerce.number().int().positive().optional(),
    forceUpdate: z.boolean().optional(),
    storeUrl: z.string().url(),
    releaseNotes: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().min(1) });

export const listAppVersions = asyncHandler(async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const result = await adminListAppVersions(query);
  res.status(200).json({ success: true, data: result, meta: result.meta });
});

export const upsertAppVersion = asyncHandler(async (req: Request, res: Response) => {
  const body = upsertBodySchema.parse(req.body);
  const result = await adminUpsertAppVersion(req.auth!.userId, body);
  res.status(200).json({ success: true, data: result, message: 'App version saved.' });
});

export const deleteAppVersion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  await adminDeleteAppVersion(req.auth!.userId, id);
  res.status(200).json({ success: true, message: 'App version removed.' });
});
