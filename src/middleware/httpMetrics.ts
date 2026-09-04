import type { Request, Response, NextFunction } from 'express';
import { metricsService } from '@/modules/reliability/metrics.service.js';

export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    res.locals.durationMs = durationMs;
    metricsService.recordHttpRequest(req.method, route, res.statusCode, durationMs);
  });

  next();
}
