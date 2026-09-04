import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/care-plans/care-plans.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  cancelSubscriptionBodySchema,
  confirmSubscriptionPaymentBodySchema,
  carePlanRecommendationQuerySchema,
  createSubscriptionBodySchema,
  eligibleEntitlementsQuerySchema,
  entitlementIdParamSchema,
  planSlugParamSchema,
  reserveEntitlementBodySchema,
  subscriptionIdParamSchema,
} from '@/validators/phase12.js';

const router = Router();

router.get('/care-plans', controller.listCarePlans);
router.get('/care-plans/recommendations', authenticate, authorize(UserRole.CUSTOMER), validateQuery(carePlanRecommendationQuerySchema), controller.getRecommendations);
router.get('/care-plans/:slug', validateParams(planSlugParamSchema), controller.getCarePlan);

router.post(
  '/subscriptions',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(createSubscriptionBodySchema),
  controller.createSubscription,
);
router.get('/subscriptions/me', authenticate, authorize(UserRole.CUSTOMER), controller.listMySubscriptions);
router.get(
  '/subscriptions/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.getSubscription,
);
router.post(
  '/subscriptions/:id/cancel',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  validateBody(cancelSubscriptionBodySchema),
  controller.cancelSubscription,
);
router.post(
  '/subscriptions/:id/pause',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.pauseSubscription,
);
router.post(
  '/subscriptions/:id/resume',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.resumeSubscription,
);
router.get(
  '/subscriptions/:id/benefits',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.listSubscriptionBenefits,
);
router.get(
  '/subscriptions/:id/usage',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.listSubscriptionUsage,
);
router.get(
  '/subscriptions/:id/invoices',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  controller.listSubscriptionInvoices,
);
router.post(
  '/subscriptions/:id/confirm-payment',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(subscriptionIdParamSchema),
  validateBody(confirmSubscriptionPaymentBodySchema),
  controller.confirmSubscriptionPayment,
);

router.get(
  '/entitlements/eligible',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(eligibleEntitlementsQuerySchema),
  controller.listEligibleEntitlements,
);
router.post(
  '/entitlements/:id/reserve',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(entitlementIdParamSchema),
  validateBody(reserveEntitlementBodySchema),
  controller.reserveEntitlement,
);
router.post(
  '/entitlements/:id/release',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(entitlementIdParamSchema),
  validateBody(reserveEntitlementBodySchema.pick({ bookingId: true })),
  controller.releaseEntitlement,
);

export default router;
