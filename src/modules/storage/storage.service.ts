import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env.js';
import { uploadToSpaces, isSpacesConfigured } from '@/modules/storage/spaces.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const GENERAL_ALLOWED_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'application/json',
  'text/plain',
  'application/octet-stream',
]);

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(';')[0].trim();
}

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

export function validateFileSignature(buffer: Buffer, mimeType: string): void {
  const normalized = normalizeMimeType(mimeType);
  const signatures = MAGIC_BYTES[normalized];
  if (!signatures) return;
  const matches = signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
  if (!matches) {
    throw new AppError('File content does not match declared type.', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export function validateUploadMime(mimeType: string): void {
  const normalized = normalizeMimeType(mimeType);
  if (!GENERAL_ALLOWED_MIME_TYPES.has(normalized)) {
    throw new AppError('Unsupported file type.', 400, ErrorCode.VALIDATION_ERROR);
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

function getFileExtension(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'application/pdf') return 'pdf';
  if (normalized === 'application/json') return 'json';
  if (normalized === 'text/plain') return 'txt';
  return 'bin';
}

async function storeFileLocally(
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
  const normalized = normalizeMimeType(mimeType);
  validateUploadMime(normalized);
  validateUploadSize(buffer.length);
  if (IMAGE_MIME_TYPES.has(normalized)) {
    validateFileSignature(buffer, normalized);
  }

  const ext = getFileExtension(normalized);
  const fileKey = `${prefix}/${randomUUID()}.${ext}`;

  if (isSpacesConfigured()) {
    try {
      const fileUrl = await uploadToSpaces(buffer, normalized, fileKey);
      return {
        fileKey,
        fileUrl,
        mimeType: normalized,
        fileSizeBytes: buffer.length,
      };
    } catch (error) {
      logger.warn('Spaces upload failed; storing file locally instead', { fileKey, error });
    }
  }

  return storeFileLocally(buffer, normalized, fileKey);
}

/** @deprecated Use storeImage for image uploads and storeFile for general files. */
export async function storeFile(
  buffer: Buffer,
  mimeType: string,
  prefix: string,
): Promise<StoredFile> {
  const normalized = normalizeMimeType(mimeType);
  validateUploadMime(normalized);
  validateUploadSize(buffer.length);
  if (IMAGE_MIME_TYPES.has(normalized) || normalized === 'application/pdf') {
    validateFileSignature(buffer, normalized);
  }

  const ext = getFileExtension(normalized);
  const fileKey = `${prefix}/${randomUUID()}.${ext}`;

  if (isSpacesConfigured()) {
    try {
      const fileUrl = await uploadToSpaces(buffer, normalized, fileKey);
      return {
        fileKey,
        fileUrl,
        mimeType: normalized,
        fileSizeBytes: buffer.length,
      };
    } catch (error) {
      logger.warn('Spaces upload failed; storing file locally instead', { fileKey, error });
    }
  }

  return storeFileLocally(buffer, normalized, fileKey);
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
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.pdf' ? 'application/pdf' : ext === '.json' ? 'application/json' : ext === '.txt' ? 'text/plain' : 'image/jpeg';
  return { buffer, mimeType };
}

export async function storePdf(buffer: Buffer, prefix: string): Promise<StoredFile> {
  return storeFile(buffer, 'application/pdf', prefix);
}
