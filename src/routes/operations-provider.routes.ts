import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/operations/operations-admin.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody } from '@/middleware/validate.js';
import { providerCapacityPatchSchema } from '@/validators/phase11.js';

const router = Router();

router.get(
  '/capacity',
  authenticate,
  authorize(UserRole.PROVIDER),
  controller.providerGetCapacity,
);
router.patch(
  '/capacity',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(providerCapacityPatchSchema),
  controller.providerPatchCapacity,
);

export default router;
