import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import * as controller from '@/modules/globalization/globalization.controller.js';
import * as apiClientController from '@/modules/globalization/api-client.controller.js';
import {
  regionResolveQuerySchema,
  createApiClientBodySchema,
} from '@/validators/phase24.js';
import { objectIdSchema } from '@ghaarfix/validation';
import { z } from 'zod';

const router = Router();

router.get('/regions/resolve', validateQuery(regionResolveQuerySchema), controller.resolveRegion);

router.post(
  '/api-clients',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createApiClientBodySchema),
  apiClientController.createClient,
);
router.post(
  '/api-clients/:id/rotate-key',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  apiClientController.rotateKey,
);
router.delete(
  '/api-clients/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  apiClientController.revokeClient,
);

export default router;
