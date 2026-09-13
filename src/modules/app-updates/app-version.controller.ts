import type { Request, Response } from 'express';
import { z } from 'zod';
import { checkAppVersion } from '@/modules/app-updates/app-version.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';

const versionCheckQuerySchema = z.object({
  app: z.enum(['customer', 'provider']),
  platform: z.enum(['ios', 'android']),
  currentVersion: z.string().min(1),
  buildNumber: z.coerce.number().int().positive().optional(),
});

export const checkVersion = asyncHandler(async (req: Request, res: Response) => {
  const query = versionCheckQuerySchema.parse(req.query);
  const result = await checkAppVersion({
    app: query.app,
    platform: query.platform,
    currentVersion: query.currentVersion,
    buildNumber: query.buildNumber,
  });

  res.status(200).json({
    success: true,
    data: result,
    message: result.forceUpdate
      ? 'A required update is available.'
      : result.updateAvailable
        ? 'An optional update is available.'
        : 'App is up to date.',
  });
});
