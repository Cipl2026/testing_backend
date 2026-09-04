import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-health/home-health.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateParams } from '@/middleware/validate.js';
import { providerIdParamSchema } from '@/validators/home-health.js';

const router = Router();

router.get('/', authenticate, authorize(UserRole.CUSTOMER), controller.listFavourites);
router.post('/:providerId', authenticate, authorize(UserRole.CUSTOMER), validateParams(providerIdParamSchema), controller.addFavourite);
router.delete('/:providerId', authenticate, authorize(UserRole.CUSTOMER), validateParams(providerIdParamSchema), controller.removeFavourite);

export default router;
