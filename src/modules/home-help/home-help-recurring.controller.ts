import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler.js';
import {
  cancelCustomerRecurringPlan,
  getCustomerRecurringPlan,
  listCustomerRecurringPlans,
  listProviderRecurringPlans,
  pauseCustomerRecurringPlan,
  resumeCustomerRecurringPlan,
  adminListRecurringPlans,
  adminUpdateRecurringPlan,
} from '@/modules/home-help/home-help-recurring.service.js';

export const listCustomerPlans = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const data = await listCustomerRecurringPlans(req.auth!.userId, { page, limit });
  res.json({ success: true, message: 'Repeat plans loaded.', data, meta: data.meta });
});

export const getCustomerPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await getCustomerRecurringPlan(req.auth!.userId, String(req.params.planId));
  res.json({ success: true, message: 'Repeat plan loaded.', data, meta: null });
});

export const cancelCustomerPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await cancelCustomerRecurringPlan(req.auth!.userId, String(req.params.planId));
  res.json({ success: true, message: 'Repeat plan cancelled.', data, meta: null });
});

export const pauseCustomerPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await pauseCustomerRecurringPlan(req.auth!.userId, String(req.params.planId));
  res.json({ success: true, message: 'Repeat plan paused.', data, meta: null });
});

export const resumeCustomerPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await resumeCustomerRecurringPlan(req.auth!.userId, String(req.params.planId));
  res.json({ success: true, message: 'Repeat plan resumed.', data, meta: null });
});

export const listProviderPlans = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const data = await listProviderRecurringPlans(req.auth!.userId, { page, limit });
  res.json({ success: true, message: 'Repeat Home Help plans loaded.', data, meta: data.meta });
});

export const adminListPlans = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);
  const data = await adminListRecurringPlans({
    page,
    limit,
    status: req.query.status as never,
    customerId: req.query.customerId as string | undefined,
    providerId: req.query.providerId as string | undefined,
  });
  res.json({ success: true, message: 'Repeat plans loaded.', data, meta: data.meta });
});

export const adminUpdatePlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await adminUpdateRecurringPlan(String(req.params.planId), req.body);
  res.json({ success: true, message: 'Repeat plan updated.', data, meta: null });
});
