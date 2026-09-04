import {
  ApprovalResourceType,
  BookingContextType,
  ErrorCode,
  OrganizationInvoiceStatus,
  OrganizationPermission,
  OrganizationPricingMode,
  WorkOrderStatus,
} from '@ghaarfix/shared-types';
import mongoose from 'mongoose';
import { Booking } from '@/models/Booking.js';
import { Organization } from '@/models/Organization.js';
import { OrganizationPricingRule, SLATracker, WorkOrder } from '@/models/OrganizationOperations.js';
import { Service } from '@/models/Service.js';
import { createBookingFromReservation } from '@/modules/bookings/booking.service.js';
import type { CreateBookingBody } from '@/validators/booking.js';
import {
  assertOrganizationPermission,
  assertPropertyInOrganization,
} from '@/modules/organizations/organization-authorization.service.js';
import { evaluateBookingApproval, createApprovalRequest } from '@/modules/organizations/approval.service.js';
import { reserveBudget, releaseBudgetReservation } from '@/modules/organizations/organization-budget.service.js';
import { createSlaTrackerForBooking } from '@/modules/organizations/sla.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { AppError } from '@/utils/AppError.js';

export async function calculateOrganizationPrice(
  organizationId: string,
  serviceId: string,
  baseAmount: number,
) {
  const service = await Service.findById(serviceId);
  const rule = await OrganizationPricingRule.findOne({
    organizationId,
    isActive: true,
    $and: [
      { $or: [{ serviceId }, { categoryId: service?.categoryId }] },
      {
        $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: new Date() } }],
      },
    ],
    validFrom: { $lte: new Date() },
  }).sort({ validFrom: -1 });

  if (!rule) return { amount: baseAmount, mode: OrganizationPricingMode.STANDARD };

  if (rule.pricingMode === OrganizationPricingMode.NEGOTIATED) {
    return { amount: rule.value, mode: rule.pricingMode };
  }
  if (rule.pricingMode === OrganizationPricingMode.CONTRACT) {
    const discounted = Math.round((baseAmount * (100 - rule.value)) / 100);
    return { amount: Math.max(0, baseAmount - discounted), mode: rule.pricingMode };
  }
  return { amount: baseAmount, mode: OrganizationPricingMode.STANDARD };
}

export async function assertCreditAllowed(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) throw new AppError('Organization not found.', 404, ErrorCode.NOT_FOUND);

  const { OrganizationInvoice } = await import('@/models/OrganizationOperations.js');
  const overdue = await OrganizationInvoice.countDocuments({
    organizationId,
    status: OrganizationInvoiceStatus.OVERDUE,
  });
  const threshold = org.billingProfile.overdueThresholdDays ?? 30;
  if (overdue > 0 && threshold <= 30) {
    throw new AppError(
      'Organization has overdue invoices. New bookings are restricted.',
      403,
      ErrorCode.FORBIDDEN,
    );
  }
}

export type OrganizationBookingInput = {
  reservationId: string;
  managedPropertyId: string;
  propertyUnitId?: string;
  paymentMethod: CreateBookingBody['paymentMethod'];
  customerNotes?: string;
  instructions?: string;
  estimatedAmount?: number;
  isUrgent?: boolean;
};

async function executeOrganizationBooking(
  userId: string,
  organizationId: string,
  input: OrganizationBookingInput,
  pricedAmount: number,
) {
  const property = await assertPropertyInOrganization(organizationId, input.managedPropertyId);
  const service = await Service.findById(
    (
      await import('@/models/SlotReservation.js')
    ).SlotReservation.findById(input.reservationId).then((r) => r?.serviceId),
  );

  await reserveBudget(organizationId, pricedAmount, input.managedPropertyId);

  try {
    const bookingDetail = await createBookingFromReservation(userId, {
      reservationId: input.reservationId,
      paymentMethod: input.paymentMethod,
      customerNotes: input.customerNotes,
    });

    const booking = await Booking.findById(bookingDetail.id);
    if (!booking) throw new AppError('Booking not created.', 500, ErrorCode.INTERNAL_ERROR);

    booking.bookingContextType = BookingContextType.ORGANIZATION;
    booking.organizationId = new mongoose.Types.ObjectId(organizationId);
    booking.managedPropertyId = new mongoose.Types.ObjectId(input.managedPropertyId);
    if (input.propertyUnitId) {
      booking.propertyUnitId = new mongoose.Types.ObjectId(input.propertyUnitId);
    }
    await booking.save();

    const workOrder = await WorkOrder.create({
      bookingId: booking._id,
      organizationId,
      propertyId: property._id,
      unitId: input.propertyUnitId,
      instructions: input.instructions,
      status: WorkOrderStatus.OPEN,
      assignedProviderId: booking.providerId,
    });

    booking.workOrderId = workOrder._id;
    await booking.save();

    await createSlaTrackerForBooking(organizationId, booking._id.toString(), service?._id.toString());

    await logOrganizationAudit({
      organizationId,
      actorId: userId,
      action: 'ORG_BOOKING_CREATED',
      resourceType: 'Booking',
      resourceId: booking._id.toString(),
      after: { propertyId: input.managedPropertyId, amount: pricedAmount },
    });

    return {
      booking: bookingDetail,
      workOrderId: workOrder._id.toString(),
      bookingId: booking._id.toString(),
    };
  } catch (error) {
    await releaseBudgetReservation(organizationId, pricedAmount, input.managedPropertyId);
    throw error;
  }
}

export async function finalizeOrganizationBookingAfterApproval(
  userId: string,
  approval: { organizationId: { toString(): string }; metadata?: Record<string, unknown> },
) {
  const meta = approval.metadata as OrganizationBookingInput & { pricedAmount?: number };
  if (!meta?.reservationId || !meta.managedPropertyId) {
    throw new AppError('Approval missing booking metadata.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const organizationId = approval.organizationId.toString();
  const pricedAmount = meta.pricedAmount ?? meta.estimatedAmount ?? 0;

  return executeOrganizationBooking(userId, organizationId, meta, pricedAmount);
}

export async function createOrganizationBooking(
  userId: string,
  organizationId: string,
  input: OrganizationBookingInput,
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.CREATE_BOOKING);
  await assertCreditAllowed(organizationId);
  await assertPropertyInOrganization(organizationId, input.managedPropertyId);

  const service = await Service.findById(
    (
      await import('@/models/SlotReservation.js')
    ).SlotReservation.findById(input.reservationId).then((r) => r?.serviceId),
  );
  const baseAmount = input.estimatedAmount ?? service?.pricing.startingPrice ?? 0;
  const priced = await calculateOrganizationPrice(
    organizationId,
    service?._id.toString() ?? '',
    baseAmount,
  );

  const approval = await evaluateBookingApproval({
    organizationId,
    estimatedAmount: priced.amount,
    categoryId: service?.categoryId?.toString(),
    isUrgent: input.isUrgent,
  });

  if (approval.required && !approval.autoApproved) {
    const approvalRequest = await createApprovalRequest({
      organizationId,
      resourceType: ApprovalResourceType.BOOKING,
      resourceId: `pending-${input.reservationId}`,
      requestedBy: userId,
      metadata: { ...input, pricedAmount: priced.amount },
    });
    return { status: 'PENDING_APPROVAL', approvalId: approvalRequest._id.toString() };
  }

  const result = await executeOrganizationBooking(userId, organizationId, input, priced.amount);
  return { status: 'CREATED', booking: result.booking, workOrderId: result.workOrderId };
}

export async function listOrganizationBookings(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);

  const bookings = await Booking.find({
    organizationId,
    bookingContextType: BookingContextType.ORGANIZATION,
  })
    .sort({ createdAt: -1 })
    .limit(100);

  return bookings.map((b) => ({
    id: b._id.toString(),
    bookingNumber: b.bookingNumber,
    status: b.status,
    managedPropertyId: b.managedPropertyId?.toString(),
    propertyUnitId: b.propertyUnitId?.toString(),
    scheduledStart: b.scheduledStart,
    finalAmount: b.price.finalAmount,
  }));
}

/** Tenant privacy: only org-scoped bookings returned above — never personal customer history */

export async function getOrganizationBookingSla(
  userId: string,
  organizationId: string,
  bookingId: string,
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  const tracker = await SLATracker.findOne({ organizationId, bookingId });
  if (!tracker) return null;
  return {
    status: tracker.status,
    responseTargetAt: tracker.responseTargetAt,
    completionTargetAt: tracker.completionTargetAt,
    breachReason: tracker.breachReason,
  };
}
