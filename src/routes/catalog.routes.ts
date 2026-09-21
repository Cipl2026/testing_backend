import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as catalogController from '@/modules/services/catalog.controller.js';
import { searchRateLimit } from '@/middleware/searchRateLimit.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateParams, validateQuery } from '@/middleware/validate.js';
import {
  categoryIdParamSchema,
  searchQuerySchema,
  serviceIdParamSchema,
  serviceListQuerySchema,
  slugParamSchema,
} from '@/validators/catalog.js';

const router = Router();

router.get('/categories', catalogController.listCategories);
router.get('/categories/:categoryId', validateParams(categoryIdParamSchema), catalogController.getCategory);
router.get(
  '/categories/:categoryId/subcategories',
  validateParams(categoryIdParamSchema),
  catalogController.listSubcategories,
);

router.get('/services/featured', catalogController.getFeatured);
router.get('/services/urgent', catalogController.getUrgentServices);
router.get('/services/search', searchRateLimit, validateQuery(searchQuerySchema), catalogController.searchServices);
router.get(
  '/services/recent',
  authenticate,
  authorize(UserRole.CUSTOMER),
  catalogController.listRecent,
);
router.get(
  '/services/favorites',
  authenticate,
  authorize(UserRole.CUSTOMER),
  catalogController.listFavorites,
);
router.get('/services/slug/:slug', validateParams(slugParamSchema), catalogController.getServiceBySlug);
router.get('/services', validateQuery(serviceListQuerySchema), catalogController.listServices);
router.get('/services/:serviceId', validateParams(serviceIdParamSchema), catalogController.getService);
router.post(
  '/services/:serviceId/favorite',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  catalogController.addFavorite,
);
router.delete(
  '/services/:serviceId/favorite',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  catalogController.removeFavorite,
);

export default router;
