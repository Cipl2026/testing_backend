import type { RequestHandler } from 'express';
import morgan from 'morgan';
import { env } from '@/config/env.js';

const noisyPaths = new Set(['/', '/json/version', '/favicon.ico']);

export const requestLogger: RequestHandler =
  env.nodeEnv === 'production'
    ? morgan('combined')
    : morgan('dev', {
        skip: (req, res) => {
          if (env.logLevel === 'debug') return false;
          if (noisyPaths.has(req.path)) return true;
          if (res.statusCode >= 500) return false;
          if (res.statusCode >= 400 && req.path.startsWith('/api')) return false;
          if (!req.path.startsWith('/api')) return true;
          return false;
        },
      });
