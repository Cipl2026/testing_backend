import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import * as controller from '@/modules/customer-lifecycle/customer-lifecycle.controller.js';
import {
  consentBodySchema,
  redeemRewardBodySchema,
  recommendationIdParamSchema,
} from '@/validators/phase20.js';

const router = Router();

router.get('/customer/lifecycle', authenticate, authorize(UserRole.CUSTOMER), controller.getLifecycle);
router.get('/customer/recommendations', authenticate, authorize(UserRole.CUSTOMER), controller.getRecommendations);
router.patch(
  '/customer/recommendations/:id/dismiss',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recommendationIdParamSchema),
  controller.dismissRecommendation,
);
router.get('/customer/maintenance', authenticate, authorize(UserRole.CUSTOMER), controller.getMaintenance);
router.get('/customer/loyalty', authenticate, authorize(UserRole.CUSTOMER), controller.getLoyalty);
router.get('/customer/loyalty/history', authenticate, authorize(UserRole.CUSTOMER), controller.getLoyaltyHistory);
router.get('/customer/rewards', authenticate, authorize(UserRole.CUSTOMER), controller.getRewards);
router.post(
  '/customer/rewards/:id/redeem',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(recommendationIdParamSchema),
  validateBody(redeemRewardBodySchema),
  controller.redeemReward,
);
router.get('/customer/referral', authenticate, authorize(UserRole.CUSTOMER), controller.getReferral);
router.get(
  '/customer/communication-preferences',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getCommunicationPreferences,
);
router.patch(
  '/customer/communication-preferences',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(consentBodySchema),
  controller.updateCommunicationPreferences,
);
router.get('/customer/for-you', authenticate, authorize(UserRole.CUSTOMER), controller.getForYou);

export default router;
