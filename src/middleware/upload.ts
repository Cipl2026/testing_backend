import multer from 'multer';
import { env } from '@/config/env.js';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxFileSizeBytes },
});
