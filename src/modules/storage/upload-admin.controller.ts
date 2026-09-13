import type { Request } from 'express';

import { storeImage } from '@/modules/storage/storage.service.js';
import { isSpacesConfigured } from '@/modules/storage/spaces.service.js';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const ALLOWED_FOLDERS = new Set(['catalog', 'categories', 'subcategories', 'services', 'home-carousel', 'branding']);

export const uploadCatalogImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Image file is required.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const folderRaw = typeof req.body.folder === 'string' ? req.body.folder.trim() : 'catalog';
  const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'catalog';

  const stored = await storeImage(req.file.buffer, req.file.mimetype, folder);

  sendSuccess(
    res,
    'Image uploaded successfully',
    {
      ...stored,
      fileUrl: resolvePublicFileUrl(req, stored.fileUrl),
    },
    201,
  );
});

export const getUploadConfig = asyncHandler(async (_req, res) => {
  sendSuccess(res, 'Upload configuration', {
    provider: isSpacesConfigured() ? 'digitalocean_spaces' : 'local',
    cdnBase: env.spaces.cdnBase ?? null,
    bucket: env.spaces.bucket ?? null,
    region: env.spaces.region ?? null,
    maxFileSizeMb: Math.round(env.storage.maxFileSizeBytes / 1024 / 1024),
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageRequiredOnCreate: true,
    supportsExternalUrl: true,
  });
});

function resolvePublicFileUrl(req: Request, fileUrl: string): string {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ?? req.protocol;
  const host = req.get('host');
  if (!host) return fileUrl;

  return `${protocol}://${host}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}
