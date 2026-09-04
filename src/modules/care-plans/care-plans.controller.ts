import * as subscriptionService from '@/modules/care-plans/subscription.service.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import * as pricingEngine from '@/modules/care-plans/pricing-engine.service.js';
import * as billingService from '@/modules/care-plans/subscription-billing.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listCarePlans = asyncHandler(async (_req, res) => {
  const items = await subscriptionService.listActiveCarePlans();
  sendSuccess(res, 'Care plans fetched', { items });
});

export const getCarePlan = asyncHandler(async (req, res) => {
  const plan = await subscriptionService.getCarePlanBySlug(String(req.params.slug));
  sendSuccess(res, 'Care plan fetched', plan);
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const { homeId } = req.query as { homeId?: string };
  const result = await subscriptionService.recommendCarePlan(req.auth!.userId, homeId);
  sendSuccess(res, 'Plan recommendation fetched', result);
});

export const createSubscription = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const result = await subscriptionService.createSubscription(req.auth!.userId, {
    ...req.body,
    idempotencyKey,
  });
  sendSuccess(res, 'Subscription created', result, 201);
});

export const listMySubscriptions = asyncHandler(async (req, res) => {
  const items = await subscriptionService.getCustomerSubscriptions(req.auth!.userId);
  sendSuccess(res, 'Subscriptions fetched', { items });
});

export const getSubscription = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.getSubscriptionDetail(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Subscription fetched', sub);
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.cancelSubscription(
    req.auth!.userId,
    String(req.params.id),
    req.body.immediate,
  );
  sendSuccess(res, 'Subscription cancelled', sub);
});

export const pauseSubscription = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.pauseSubscription(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Subscription paused', sub);
});

export const resumeSubscription = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.resumeSubscription(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Subscription resumed', sub);
});

export const listSubscriptionBenefits = asyncHandler(async (req, res) => {
  const items = await entitlementService.listSubscriptionEntitlements(
    req.auth!.userId,
    String(req.params.id),
  );
  sendSuccess(res, 'Benefits fetched', { items });
});

export const listSubscriptionUsage = asyncHandler(async (req, res) => {
  const sub = await subscriptionService.getSubscriptionDetail(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Usage fetched', { entitlements: sub.entitlements });
});

export const listSubscriptionInvoices = asyncHandler(async (req, res) => {
  const items = await billingService.listSubscriptionInvoices(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Invoices fetched', { items });
});

export const listEligibleEntitlements = asyncHandler(async (req, res) => {
  const { serviceId, homeId, categoryId } = req.query as {
    serviceId: string;
    homeId?: string;
    categoryId?: string;
  };
  const items = await pricingEngine.getEligibleBenefitsForCheckout({
    customerId: req.auth!.userId,
    serviceId,
    homeId,
    categoryId,
  });
  sendSuccess(res, 'Eligible entitlements fetched', { items });
});

export const reserveEntitlement = asyncHandler(async (req, res) => {
  const usage = await entitlementService.reserveEntitlement(
    req.auth!.userId,
    String(req.params.id),
    req.body.bookingId,
    req.body.amountApplied,
  );
  sendSuccess(res, 'Entitlement reserved', usage, 201);
});

export const releaseEntitlement = asyncHandler(async (req, res) => {
  const { bookingId } = req.body as { bookingId: string };
  const usage = await entitlementService.releaseEntitlementReservation(String(req.params.id), bookingId);
  sendSuccess(res, 'Entitlement released', usage);
});

export const confirmSubscriptionPayment = asyncHandler(async (req, res) => {
  const sub = await billingService.confirmCustomerSubscriptionPayment(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Subscription activated', sub);
});
