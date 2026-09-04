import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env.js';
import { uploadToSpaces, isSpacesConfigured } from '@/modules/storage/spaces.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StoredFile {
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}

async function ensureUploadDir(): Promise<string> {
  const dir = path.resolve(env.storage.uploadDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

export function validateFileSignature(buffer: Buffer, mimeType: string): void {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return;
  const matches = signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
  if (!matches) {
    throw new AppError('File content does not match declared type.', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export function validateUploadMime(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError('Unsupported file type. Use JPEG, PNG, or WebP.', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export function validateUploadSize(sizeBytes: number): void {
  if (sizeBytes > env.storage.maxFileSizeBytes) {
    throw new AppError(
      `File too large. Maximum ${Math.round(env.storage.maxFileSizeBytes / 1024 / 1024)}MB.`,
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

async function storeImageLocally(
  buffer: Buffer,
  mimeType: string,
  fileKey: string,
): Promise<StoredFile> {
  const dir = await ensureUploadDir();
  const fullPath = path.join(dir, fileKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    fileKey,
    fileUrl: `/api/v1/files/${fileKey}`,
    mimeType,
    fileSizeBytes: buffer.length,
  };
}

export async function storeImage(
  buffer: Buffer,
  mimeType: string,
  prefix: string,
): Promise<StoredFile> {
  validateUploadMime(mimeType);
  validateUploadSize(buffer.length);
  validateFileSignature(buffer, mimeType);

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileKey = `${prefix}/${randomUUID()}.${ext}`;

  if (isSpacesConfigured()) {
    try {
      const fileUrl = await uploadToSpaces(buffer, mimeType, fileKey);
      return {
        fileKey,
        fileUrl,
        mimeType,
        fileSizeBytes: buffer.length,
      };
    } catch (error) {
      logger.warn('Spaces upload failed; storing image locally instead', { fileKey, error });
    }
  }

  return storeImageLocally(buffer, mimeType, fileKey);
}

/** @deprecated Use storeImage for new uploads. */
export async function storeFile(
  buffer: Buffer,
  mimeType: string,
  prefix: string,
): Promise<StoredFile> {
  return storeImage(buffer, mimeType, prefix);
}

export async function readStoredFile(fileKey: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const fullPath = path.resolve(env.storage.uploadDir, fileKey);
  const uploadRoot = path.resolve(env.storage.uploadDir);
  if (!fullPath.startsWith(uploadRoot)) {
    throw new AppError('Invalid file path.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const buffer = await fs.readFile(fullPath);
  const ext = path.extname(fileKey).toLowerCase();
  const mimeType =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { buffer, mimeType };
}

export async function storePdf(buffer: Buffer, prefix: string): Promise<StoredFile> {
  const fileKey = `${prefix}/${randomUUID()}.pdf`;
  const dir = await ensureUploadDir();
  const fullPath = path.join(dir, fileKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  return {
    fileKey,
    fileUrl: `/api/v1/files/${fileKey}`,
    mimeType: 'application/pdf',
    fileSizeBytes: buffer.length,
  };
}
