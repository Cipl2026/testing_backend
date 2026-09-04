import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env.js';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler.js';
import { httpMetricsMiddleware } from '@/middleware/httpMetrics.js';
import { maintenanceModeMiddleware } from '@/middleware/maintenanceMode.js';
import { observabilityContextMiddleware } from '@/middleware/observabilityContext.js';
import { generalLimiter } from '@/middleware/rateLimit.js';
import { requestIdMiddleware } from '@/middleware/requestId.js';
import { requestLogger } from '@/middleware/requestLogger.js';
import apiRoutes from '@/routes/index.js';
import * as paymentController from '@/modules/payments/payment.controller.js';

export function createApp(): express.Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.post(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' }),
    paymentController.paymentWebhook,
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(observabilityContextMiddleware);
  app.use(httpMetricsMiddleware);
  app.use(requestLogger);
  if (!env.isTest) {
    app.use(generalLimiter);
  }
  app.use(async (req, res, next) => {
    try {
      await maintenanceModeMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
