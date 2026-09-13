import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler.js';
import {
  createDurationPackage,
  deleteDurationPackage,
  listDurationPackages,
  updateDurationPackage,
} from '@/modules/home-help/home-help-admin.service.js';
import {
  getHomeHelpCompatibilityConfigAdmin,
  updateHomeHelpCompatibilityConfig,
} from '@/modules/home-help/compatibility-config.service.js';

export const listPackages = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);
  const activeOnly = req.query.activeOnly === 'true';
  const data = await listDurationPackages({ page, limit, activeOnly });
  res.json({ success: true, message: 'Duration packages loaded.', data, meta: data.meta });
});

export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  const data = await createDurationPackage(req.body);
  res.status(201).json({ success: true, message: 'Duration package created.', data, meta: null });
});

export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateDurationPackage(String(req.params.packageId), req.body);
  res.json({ success: true, message: 'Duration package updated.', data, meta: null });
});

export const removePackage = asyncHandler(async (req: Request, res: Response) => {
  const data = await deleteDurationPackage(String(req.params.packageId));
  res.json({ success: true, message: 'Duration package deactivated.', data, meta: null });
});

export const getCompatibilityConfig = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getHomeHelpCompatibilityConfigAdmin();
  res.json({ success: true, message: 'Compatibility rules loaded.', data, meta: null });
});

export const updateCompatibilityConfig = asyncHandler(async (req: Request, res: Response) => {
  const data = await updateHomeHelpCompatibilityConfig(req.auth!.userId, req.body);
  res.json({ success: true, message: 'Compatibility rules updated.', data, meta: null });
});
