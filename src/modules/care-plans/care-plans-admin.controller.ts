import * as adminService from '@/modules/care-plans/care-plan-admin.service.js';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const adminListPlans = asyncHandler(async (_req, res) => {
  const items = await adminService.listAllPlans();
  sendSuccess(res, 'Care plans fetched', {
    items: items.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      status: p.status,
      scopeType: p.scopeType,
      currentVersion: p.currentVersion,
    })),
  });
});

export const adminCreatePlan = asyncHandler(async (req, res) => {
  const result = await adminService.createPlan(req.body);
  sendSuccess(res, 'Care plan created', {
    id: result.plan._id.toString(),
    slug: result.plan.slug,
  }, 201);
});

export const adminActivatePlan = asyncHandler(async (req, res) => {
  const plan = await adminService.activatePlan(String(req.params.id));
  if (!plan) throw new AppError('Plan not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Plan activated', { id: plan._id.toString(), status: plan.status });
});

export const adminPublishVersion = asyncHandler(async (req, res) => {
  const version = await adminService.publishPlanVersion(String(req.params.id));
  sendSuccess(res, 'Plan version published', { version: version.version });
});

export const adminUpsertPrice = asyncHandler(async (req, res) => {
  const price = await adminService.upsertPlanPrice({ planId: String(req.params.id), ...req.body });
  sendSuccess(res, 'Plan price updated', price);
});

export const adminAddBenefit = asyncHandler(async (req, res) => {
  const benefit = await adminService.addPlanBenefit({ planId: String(req.params.id), ...req.body });
  sendSuccess(res, 'Plan benefit added', { id: benefit._id.toString() }, 201);
});

export const adminListSubscriptions = asyncHandler(async (req, res) => {
  const { status } = req.query as { status?: string };
  const items = await adminService.listAdminSubscriptions({ status });
  sendSuccess(res, 'Subscriptions fetched', {
    items: items.map((s) => ({
      id: s._id.toString(),
      customerId: s.customerId.toString(),
      planId: s.planId.toString(),
      status: s.status,
      billingInterval: s.billingInterval,
      nextBillingAt: s.nextBillingAt,
    })),
  });
});

export const adminGetSubscription = asyncHandler(async (req, res) => {
  const detail = await adminService.getAdminSubscriptionDetail(String(req.params.id));
  if (!detail) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Subscription detail fetched', detail);
});

export const adminAdjustEntitlement = asyncHandler(async (req, res) => {
  const ent = await entitlementService.adminAdjustEntitlement(
    req.auth!.userId,
    req.body.entitlementId,
    req.body.delta,
    req.body.reason,
  );
  sendSuccess(res, 'Entitlement adjusted', ent);
});

export const adminChangeStatus = asyncHandler(async (req, res) => {
  const { Subscription } = await import('@/models/Subscription.js');
  const sub = await Subscription.findByIdAndUpdate(
    String(req.params.id),
    { status: req.body.status },
    { new: true },
  );
  if (!sub) throw new AppError('Subscription not found.', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Subscription status updated', { id: sub._id.toString(), status: sub.status });
});

export const adminAnalytics = asyncHandler(async (_req, res) => {
  const analytics = await adminService.getSubscriptionAnalytics();
  sendSuccess(res, 'Subscription analytics fetched', analytics);
});
