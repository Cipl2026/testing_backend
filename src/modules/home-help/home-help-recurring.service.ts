import { DateTime } from 'luxon';
import { Types } from 'mongoose';
import type { HomeHelpTaskSelection, QuickServicesRecurringSchedule } from '@ghaarfix/shared-types';
import {
  PaymentMethod,
  ErrorCode,
} from '@ghaarfix/shared-types';
import {
  HomeHelpRecurringPlan,
  HomeHelpRecurringPlanStatus,
  type IHomeHelpRecurringPlan,
} from '@/models/HomeHelpRecurringPlan.js';
import { HomeHelpDurationPackage } from '@/models/HomeHelpDurationPackage.js';
import { getAnchorService } from '@/modules/home-help/home-help-catalog.service.js';
import { buildHomeHelpReservationPayload } from '@/modules/home-help/home-help-quote.service.js';
import { AppError } from '@/utils/AppError.js';
import { buildPaginationMeta } from '@/utils/catalog.js';

const TIMEZONE = 'Asia/Kolkata';

export function computeOccurrenceDateTime(date: string, preferredTime: string): Date {
  const [hour, minute] = preferredTime.split(':').map(Number);
  const dt = DateTime.fromISO(date, { zone: TIMEZONE }).set({
    hour: hour ?? 9,
    minute: minute ?? 0,
    second: 0,
    millisecond: 0,
  });
  if (!dt.isValid) {
    throw new AppError('Invalid recurring schedule date or time.', 400, ErrorCode.VALIDATION_ERROR);
  }
  return dt.toJSDate();
}

export function computeNextOccurrence(
  from: Date,
  recurring: QuickServicesRecurringSchedule,
): Date | null {
  if (recurring.endDate) {
    const end = DateTime.fromISO(recurring.endDate, { zone: TIMEZONE }).endOf('day');
    if (DateTime.fromJSDate(from) > end) return null;
  }

  const base = DateTime.fromJSDate(from, { zone: TIMEZONE });
  const [hour, minute] = recurring.preferredTime.split(':').map(Number);

  let next = base;
  switch (recurring.frequency) {
    case 'daily':
      next = base.plus({ days: 1 });
      break;
    case 'weekly':
      next = base.plus({ weeks: 1 });
      break;
    case 'monthly':
      next = base.plus({ months: 1 });
      break;
    case 'custom':
      next = base.plus({ weeks: 1 });
      break;
    default:
      next = base.plus({ weeks: 1 });
  }

  const scheduled = next.set({ hour: hour ?? 9, minute: minute ?? 0, second: 0, millisecond: 0 });
  if (recurring.endDate) {
    const end = DateTime.fromISO(recurring.endDate, { zone: TIMEZONE }).endOf('day');
    if (scheduled > end) return null;
  }
  return scheduled.toJSDate();
}

async function serializeRecurringPlan(plan: IHomeHelpRecurringPlan) {
  const durationPackage = await HomeHelpDurationPackage.findById(plan.durationPackageId).lean();
  return {
    id: plan._id.toString(),
    customerId: plan.customerId.toString(),
    addressId: plan.addressId.toString(),
    providerId: plan.providerId?.toString(),
    durationPackageId: plan.durationPackageId.toString(),
    durationLabel: durationPackage?.label,
    durationMinutes: durationPackage?.durationMinutes,
    tasks: plan.tasks.map((task) => ({
      serviceId: task.serviceId.toString(),
      name: task.name,
      priority: task.priority,
      notes: task.notes,
    })),
    recurring: plan.recurring,
    generalNotes: plan.generalNotes,
    paymentMethod: plan.paymentMethod,
    status: plan.status,
    nextOccurrenceAt: plan.nextOccurrenceAt?.toISOString(),
    lastBookingId: plan.lastBookingId?.toString(),
    lastReservationId: plan.lastReservationId?.toString(),
    occurrencesCompleted: plan.occurrencesCompleted,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export async function createHomeHelpRecurringPlan(input: {
  customerId: string;
  addressId: string;
  providerId?: string;
  durationPackageId: string;
  tasks: HomeHelpTaskSelection[];
  generalNotes?: string;
  paymentMethod: PaymentMethod;
  recurring: QuickServicesRecurringSchedule;
  reservationId?: string;
  bookingId?: string;
}) {
  const [anchorService, homeHelpPayload] = await Promise.all([
    getAnchorService(),
    buildHomeHelpReservationPayload({
      durationPackageId: input.durationPackageId,
      tasks: input.tasks,
      generalNotes: input.generalNotes,
    }),
  ]);

  const firstOccurrence = computeOccurrenceDateTime(
    input.recurring.startDate,
    input.recurring.preferredTime,
  );
  const nextOccurrenceAt = computeNextOccurrence(firstOccurrence, input.recurring);

  const plan = await HomeHelpRecurringPlan.create({
    customerId: new Types.ObjectId(input.customerId),
    addressId: new Types.ObjectId(input.addressId),
    providerId: input.providerId ? new Types.ObjectId(input.providerId) : undefined,
    durationPackageId: new Types.ObjectId(homeHelpPayload.durationPackageId),
    anchorServiceId: anchorService._id,
    tasks: homeHelpPayload.tasks.map((task) => ({
      serviceId: new Types.ObjectId(task.serviceId),
      name: task.name,
      priority: task.priority,
      notes: task.notes,
    })),
    recurring: input.recurring,
    generalNotes: input.generalNotes,
    paymentMethod: input.paymentMethod,
    status: HomeHelpRecurringPlanStatus.ACTIVE,
    nextOccurrenceAt: nextOccurrenceAt ?? undefined,
    lastReservationId: input.reservationId ? new Types.ObjectId(input.reservationId) : undefined,
    lastBookingId: input.bookingId ? new Types.ObjectId(input.bookingId) : undefined,
    occurrencesCompleted: input.bookingId ? 1 : 0,
  });

  return {
    id: plan._id.toString(),
    nextOccurrenceAt: plan.nextOccurrenceAt?.toISOString(),
    firstOccurrenceAt: firstOccurrence.toISOString(),
  };
}

export async function linkRecurringPlanToConfirmedBooking(input: {
  reservationId: string;
  bookingId: string;
}) {
  const plan = await HomeHelpRecurringPlan.findOne({
    lastReservationId: new Types.ObjectId(input.reservationId),
    status: { $in: [HomeHelpRecurringPlanStatus.ACTIVE, HomeHelpRecurringPlanStatus.PAUSED] },
  });
  if (!plan) return null;

  plan.lastBookingId = new Types.ObjectId(input.bookingId);
  plan.occurrencesCompleted = Math.max(plan.occurrencesCompleted, 1);
  await plan.save();
  return serializeRecurringPlan(plan);
}

export async function listCustomerRecurringPlans(customerId: string, query: { page: number; limit: number }) {
  const filter = { customerId: new Types.ObjectId(customerId) };
  const total = await HomeHelpRecurringPlan.countDocuments(filter);
  const plans = await HomeHelpRecurringPlan.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return {
    items: await Promise.all(plans.map((plan) => serializeRecurringPlan(plan))),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getCustomerRecurringPlan(customerId: string, planId: string) {
  const plan = await HomeHelpRecurringPlan.findOne({
    _id: planId,
    customerId: new Types.ObjectId(customerId),
  });
  if (!plan) throw new AppError('Repeat plan not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRecurringPlan(plan);
}

async function updatePlanStatus(
  filter: Record<string, unknown>,
  status: HomeHelpRecurringPlanStatus,
) {
  const plan = await HomeHelpRecurringPlan.findOneAndUpdate(
    filter,
    { status, ...(status === HomeHelpRecurringPlanStatus.CANCELLED ? { nextOccurrenceAt: null } : {}) },
    { new: true },
  );
  if (!plan) throw new AppError('Repeat plan not found.', 404, ErrorCode.NOT_FOUND);
  return serializeRecurringPlan(plan);
}

export async function cancelCustomerRecurringPlan(customerId: string, planId: string) {
  return updatePlanStatus(
    { _id: planId, customerId: new Types.ObjectId(customerId) },
    HomeHelpRecurringPlanStatus.CANCELLED,
  );
}

export async function pauseCustomerRecurringPlan(customerId: string, planId: string) {
  return updatePlanStatus(
    { _id: planId, customerId: new Types.ObjectId(customerId), status: HomeHelpRecurringPlanStatus.ACTIVE },
    HomeHelpRecurringPlanStatus.PAUSED,
  );
}

export async function resumeCustomerRecurringPlan(customerId: string, planId: string) {
  const plan = await HomeHelpRecurringPlan.findOne({
    _id: planId,
    customerId: new Types.ObjectId(customerId),
    status: HomeHelpRecurringPlanStatus.PAUSED,
  });
  if (!plan) throw new AppError('Repeat plan not found or not paused.', 404, ErrorCode.NOT_FOUND);
  if (!plan.nextOccurrenceAt && plan.lastBookingId) {
    const lastOccurrence = plan.nextOccurrenceAt ?? new Date();
    plan.nextOccurrenceAt = computeNextOccurrence(lastOccurrence, plan.recurring) ?? undefined;
  }
  plan.status = HomeHelpRecurringPlanStatus.ACTIVE;
  await plan.save();
  return serializeRecurringPlan(plan);
}

export async function listProviderRecurringPlans(providerId: string, query: { page: number; limit: number }) {
  const filter = {
    providerId: new Types.ObjectId(providerId),
    status: { $in: [HomeHelpRecurringPlanStatus.ACTIVE, HomeHelpRecurringPlanStatus.PAUSED] },
  };
  const total = await HomeHelpRecurringPlan.countDocuments(filter);
  const plans = await HomeHelpRecurringPlan.find(filter)
    .sort({ nextOccurrenceAt: 1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return {
    items: await Promise.all(plans.map((plan) => serializeRecurringPlan(plan))),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminListRecurringPlans(query: {
  page: number;
  limit: number;
  status?: HomeHelpRecurringPlanStatus;
  customerId?: string;
  providerId?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = new Types.ObjectId(query.customerId);
  if (query.providerId) filter.providerId = new Types.ObjectId(query.providerId);

  const total = await HomeHelpRecurringPlan.countDocuments(filter);
  const plans = await HomeHelpRecurringPlan.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return {
    items: await Promise.all(plans.map((plan) => serializeRecurringPlan(plan))),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminUpdateRecurringPlan(
  planId: string,
  input: { status?: HomeHelpRecurringPlanStatus; providerId?: string },
) {
  const plan = await HomeHelpRecurringPlan.findById(planId);
  if (!plan) throw new AppError('Repeat plan not found.', 404, ErrorCode.NOT_FOUND);
  if (input.status) {
    plan.status = input.status;
    if (input.status === HomeHelpRecurringPlanStatus.CANCELLED) {
      plan.nextOccurrenceAt = undefined;
    }
  }
  if (input.providerId) {
    plan.providerId = new Types.ObjectId(input.providerId);
  }
  await plan.save();
  return serializeRecurringPlan(plan);
}

export async function attachRecurringPlanToBooking(input: {
  customerId: string;
  bookingId: string;
  reservationId: string;
  providerId: string;
  addressId: string;
  durationPackageId: string;
  tasks: HomeHelpTaskSelection[];
  generalNotes?: string;
  paymentMethod: PaymentMethod;
  recurring: QuickServicesRecurringSchedule;
}) {
  return createHomeHelpRecurringPlan({
    ...input,
    reservationId: input.reservationId,
    bookingId: input.bookingId,
  });
}
