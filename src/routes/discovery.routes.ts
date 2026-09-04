import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/discovery-growth/discovery-growth.controller.js';
import { searchRateLimit } from '@/middleware/searchRateLimit.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  bookingIdParamSchema,
  bundleIdParamSchema,
  discoveryHomeQuerySchema,
  featuresQuerySchema,
  recommendationIdParamSchema,
  recommendationsQuerySchema,
  redeemReferralBodySchema,
  searchQuerySchema,
  searchSuggestionsQuerySchema,
  serviceIdParamSchema,
  validatePromotionBodySchema,
} from '@/validators/phase10.js';

const router = Router();

router.get('/search', searchRateLimit, validateQuery(searchQuerySchema), controller.search);
router.get('/search/suggestions', validateQuery(searchSuggestionsQuerySchema), controller.searchSuggestions);

router.get(
  '/recommendations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(recommendationsQuerySchema),
  controller.listRecommendations,
);
router.post(
  '/recommendations/:id/dismiss',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recommendationIdParamSchema),
  controller.dismissRecommendation,
);
router.post(
  '/recommendations/:id/click',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recommendationIdParamSchema),
  controller.clickRecommendation,
);

router.get(
  '/favourite-services',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listFavouriteServices,
);
router.post(
  '/favourite-services/:serviceId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  controller.addFavouriteService,
);
router.delete(
  '/favourite-services/:serviceId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  controller.removeFavouriteService,
);

router.get('/service-bundles', controller.listServiceBundles);
router.get('/service-bundles/:id', validateParams(bundleIdParamSchema), controller.getServiceBundle);

router.get('/promotions/active', controller.listActivePromotions);

router.post(
  '/promotions/validate',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(validatePromotionBodySchema),
  controller.validatePromotion,
);

router.get(
  '/referrals/me',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getMyReferral,
);
router.post(
  '/referrals/redeem',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(redeemReferralBodySchema),
  controller.redeemReferral,
);

router.get(
  '/rewards/balance',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getRewardBalance,
);
router.get(
  '/rewards/ledger',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getRewardLedger,
);

router.get(
  '/features',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(featuresQuerySchema),
  controller.getFeatures,
);

router.get(
  '/discovery/home',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(discoveryHomeQuerySchema),
  controller.getDiscoveryHome,
);

router.get(
  '/rebooking/:bookingId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  controller.getRebooking,
);

export default router;
