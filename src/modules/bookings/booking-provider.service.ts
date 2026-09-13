import {
  BookingStatus,
  BookingType,
  ErrorCode,
  PaymentStatus,
  PriceChangeStatus,
  ProviderRequestStatus,
  RescheduleStatus,
  TimelineEventType,
  TrackingState,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { PriceChangeRequest } from '@/models/PriceChangeRequest.js';
import { RescheduleRequest } from '@/models/RescheduleRequest.js';
import { transitionBookingStatus } from '@/modules/bookings/booking-status.service.js';
import { addTimelineEvent, listTimelineEvents } from '@/modules/bookings/timeline.service.js';
import { awardBookingRewardCoins, awardReferrerBookingCoins, processReferralQualifications } from '@/modules/discovery-growth/growth.service.js';
import { scheduleInvoiceGeneration } from '@/modules/invoices/invoice.service.js';
import { createAssetServiceRecordFromBooking } from '@/modules/home-health/maintenance.service.js';
import {
  getProviderServiceRecipient,
  notifyBookingParticipants,
} from '@/modules/booking-participants/booking-participant.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { emitBookingStatusChanged } from '@/modules/realtime/socket.service.js';
import {
  clearServiceCompletionOtp,
  emitServiceCompletionOtp,
  issueServiceCompletionOtp,
  verifyServiceCompletionOtp,
} from '@/modules/bookings/service-completion-otp.service.js';
import {
  clearServiceStartOtp,
  emitServiceStartOtp,
  issueServiceStartOtp,
  verifyServiceStartOtp,
} from '@/modules/bookings/service-start-otp.service.js';
import { initProviderConfirmationOnBooking } from '@/modules/bookings/provider-confirmation.service.js';
import { stopTrackingOnArrival } from '@/modules/tracking/location-tracking.service.js';
import { recalculateTrustMetrics } from '@/modules/trust/trust-metrics.service.js';
import { getOrCreateChecklistForService } from '@/modules/trust-protection/quality-checklist.service.js';
import { ServiceEvidence } from '@/models/ServiceEvidence.js';
import { ServiceEvidenceType } from '@ghaarfix/shared-types';
import { getBlockingIntervals } from '@/modules/provider-availability/availability.service.js';
import { WorkOrder, SLATracker } from '@/models/OrganizationOperations.js';
import { AIAnalysisResult } from '@/models/Intelligence.js';
import { AIAnalysisStatus, IntelligenceFeature } from '@ghaarfix/shared-types';
import { ManagedProperty, PropertyUnit } from '@/models/ManagedProperty.js';
import { serializeBookingDetail, serializeBookingSummary } from '@/utils/bookingSerializers.js';
import { calculateJobPricing } from '@/modules/bookings/booking-pricing.service.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';
import { intervalsOverlap } from '@/utils/intervals.js';
import { addMinutes } from '@/utils/timezone.js';
import {
  consumeEntitlementForBooking,
  releaseEntitlementForBooking,
} from '@/modules/care-plans/booking-entitlement.helper.js';

export async function listProviderBookings(
  providerId: string,
  query: { page: number; limit: number; tab?: string },
) {
  const filter: Record<string, unknown> = { providerId };
  if (query.tab === 'requests') {
    filter.status = BookingStatus.PENDING_PROVIDER;
    filter.providerRequestStatus = ProviderRequestStatus.PENDING;
  } else if (query.tab === 'upcoming') {
    filter.status = {
      $in: [BookingStatus.CONFIRMED, BookingStatus.RESCHEDULE_REQUESTED],
    };
  } else if (query.tab === 'in_progress') {
    filter.status = {
      $in: [BookingStatus.PROVIDER_EN_ROUTE, BookingStatus.PROVIDER_ARRIVED, BookingStatus.IN_PROGRESS],
    };
  } else if (query.tab === 'completed') {
    filter.status = BookingStatus.COMPLETED;
  } else if (query.tab === 'cancelled') {
    filter.status = BookingStatus.CANCELLED;
  }

  const total = await Booking.countDocuments(filter);
  const items = await Booking.find(filter)
    .sort({ scheduledStart: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  return {
    items: items.map((booking) => serializeBookingSummary(booking, 'provider')),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getProviderBooking(providerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  const serviceRecipient = await getProviderServiceRecipient(bookingId);

  let workOrderContext: Record<string, unknown> | undefined;
  if (booking.organizationId) {
    const workOrder = await WorkOrder.findOne({ bookingId: booking._id });
    const property = booking.managedPropertyId
      ? await ManagedProperty.findById(booking.managedPropertyId).select('name type address')
      : null;
    const unit = booking.propertyUnitId
      ? await PropertyUnit.findById(booking.propertyUnitId).select('name unitNumber floor')
      : null;
    const sla = await SLATracker.findOne({ bookingId: booking._id }).select('status');
    workOrderContext = {
      propertyName: property?.name,
      propertyType: property?.type,
      propertyAddress: property?.address,
      unitName: unit?.name ?? unit?.unitNumber,
      unitFloor: unit?.floor,
      instructions: workOrder?.instructions,
      checklist: workOrder?.checklist,
      slaStatus: sla?.status,
    };
  }

  const analysis = await AIAnalysisResult.findOne({
    customerId: booking.customerId,
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    status: AIAnalysisStatus.COMPLETED,
    createdAt: { $lte: booking.createdAt },
  }).sort({ createdAt: -1 });

  const intelligenceSummary = analysis?.result
    ? {
        category: (analysis.result as { category?: string }).category,
        explanation: (analysis.result as { explanation?: string }).explanation,
        analysisId: analysis._id.toString(),
      }
    : undefined;

  return serializeBookingDetail(booking, await listTimelineEvents(bookingId), {
    serviceRecipient,
    workOrder: workOrderContext,
    intelligenceSummary,
  }, 'provider');
}

async function getOwnedBooking(
  providerId: string,
  bookingId: string,
  options?: { includeCompletionOtp?: boolean; includeStartOtp?: boolean },
) {
  const query = Booking.findOne({ _id: bookingId, providerId });
  if (options?.includeCompletionOtp) {
    query.select('+tracking.serviceCompletionOtp +tracking.serviceStartOtp');
  }
  if (options?.includeStartOtp) {
    query.select('+tracking.serviceStartOtp');
  }
  const booking = await query;
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  return booking;
}

export async function acceptBooking(providerId: string, bookingId: string) {
  const booking = await getOwnedBooking(providerId, bookingId);
  if (booking.providerRequestStatus !== ProviderRequestStatus.PENDING) {
    throw new AppError('This booking request has already been processed.', 409, ErrorCode.CONFLICT);
  }

  booking.status = transitionBookingStatus(booking.status, 'PROVIDER_ACCEPT', UserRole.PROVIDER);
  booking.providerRequestStatus = ProviderRequestStatus.ACCEPTED;
  initProviderConfirmationOnBooking(booking);
  await booking.save();

  await consumeEntitlementForBooking(booking);

  const { recordSlaEvent } = await import('@/modules/organizations/sla.service.js');
  await recordSlaEvent(bookingId, 'ACCEPTED');

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.PROVIDER_ACCEPTED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });
  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.BOOKING_CONFIRMED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'BOOKING_ACCEPTED',
    'Booking accepted',
    'Your professional accepted the booking.',
    bookingId,
  );

  return serializeBookingSummary(booking, 'provider');
}

export async function rejectBooking(
  providerId: string,
  bookingId: string,
  reason: string,
  category?: string,
) {
  const booking = await getOwnedBooking(providerId, bookingId);
  if (booking.providerRequestStatus !== ProviderRequestStatus.PENDING) {
    throw new AppError('This booking request has already been processed.', 409, ErrorCode.CONFLICT);
  }

  booking.status = transitionBookingStatus(booking.status, 'PROVIDER_REJECT', UserRole.PROVIDER);
  booking.providerRequestStatus = ProviderRequestStatus.REJECTED;
  booking.cancellation = {
    reason,
    actorId: booking.providerId,
    actorRole: UserRole.PROVIDER,
    cancelledAt: new Date(),
  };
  await booking.save();

  await releaseEntitlementForBooking(booking);

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.PROVIDER_REJECTED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { reason, category },
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'BOOKING_REJECTED',
    'Booking declined',
    reason.trim() || 'Your booking request was declined by the professional.',
    bookingId,
  );

  return serializeBookingSummary(booking, 'provider');
}

export async function updateBookingStatusAction(
  providerId: string,
  bookingId: string,
  action: 'PROVIDER_EN_ROUTE' | 'PROVIDER_ARRIVE' | 'START_SERVICE' | 'COMPLETE_SERVICE',
  options?: { completionOtp?: string; startOtp?: string },
) {
  const booking = await getOwnedBooking(providerId, bookingId, {
    includeCompletionOtp: action === 'COMPLETE_SERVICE',
    includeStartOtp: action === 'START_SERVICE',
  });

  if (action === 'START_SERVICE') {
    const startVerification = verifyServiceStartOtp(booking, options?.startOtp ?? '');
    if (!startVerification.ok) {
      await booking.save();
      throw new AppError(startVerification.reason, 400, ErrorCode.VALIDATION_ERROR);
    }

    const checklist = await getOrCreateChecklistForService(booking.serviceId.toString());
    if (checklist.requiredEvidence.includes(ServiceEvidenceType.BEFORE)) {
      const beforeCount = await ServiceEvidence.countDocuments({
        bookingId: booking._id,
        type: ServiceEvidenceType.BEFORE,
      });
      if (beforeCount === 0) {
        throw new AppError(
          'Upload a before photo before starting the service.',
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    clearServiceStartOtp(booking);
  }

  if (action === 'COMPLETE_SERVICE') {
    const verification = verifyServiceCompletionOtp(booking, options?.completionOtp ?? '');
    if (!verification.ok) {
      throw new AppError(verification.reason, 400, ErrorCode.VALIDATION_ERROR);
    }
    clearServiceCompletionOtp(booking);
  }

  const nextStatus = transitionBookingStatus(booking.status, action, UserRole.PROVIDER);

  // Atomic conditional claim: the status transition itself must be atomic so
  // concurrent duplicate actions (double start / double complete) cannot both
  // succeed and re-trigger rewards, invoices, or finance outbox side effects.
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { $set: { status: nextStatus } },
    { new: true },
  );
  if (!claimed) {
    const current = await Booking.findById(booking._id).select('status');
    if (current && current.status === nextStatus) {
      // Idempotent retry: the action already went through.
      return serializeBookingSummary(booking, 'provider');
    }
    throw new AppError(
      'Booking status was just updated by another action.',
      409,
      ErrorCode.CONFLICT,
    );
  }
  booking.status = nextStatus;

  if (action === 'PROVIDER_EN_ROUTE') {
    if (!booking.tracking) booking.tracking = { state: TrackingState.NOT_TRACKING };
    booking.tracking.state = TrackingState.EN_ROUTE;
  }

  if (action === 'PROVIDER_ARRIVE') {
    if (!booking.tracking) booking.tracking = { state: TrackingState.NOT_TRACKING };
    booking.tracking.state = TrackingState.ARRIVED;
    const startOtp = issueServiceStartOtp(booking);
    emitServiceStartOtp(booking.customerId.toString(), bookingId, startOtp);
  }

  if (action === 'START_SERVICE') {
    if (!booking.tracking) booking.tracking = { state: TrackingState.NOT_TRACKING };
    booking.tracking.state = TrackingState.SERVICE_ACTIVE;
    issueServiceCompletionOtp(booking);
  }

  if (action === 'COMPLETE_SERVICE') {
    if (!booking.tracking) booking.tracking = { state: TrackingState.NOT_TRACKING };
    booking.tracking.state = TrackingState.COMPLETED;
    await processReferralQualifications(bookingId);
    await awardBookingRewardCoins(
      bookingId,
      booking.customerId.toString(),
      booking.price?.finalAmount ?? 0,
    );
    await awardReferrerBookingCoins(bookingId, booking.customerId.toString());
  }

  await booking.save();

  if (action === 'START_SERVICE' && booking.tracking?.serviceCompletionOtp) {
    emitServiceCompletionOtp(
      booking.customerId.toString(),
      bookingId,
      booking.tracking.serviceCompletionOtp,
    );
  }

  const typeMap = {
    PROVIDER_EN_ROUTE: TimelineEventType.PROVIDER_EN_ROUTE,
    PROVIDER_ARRIVE: TimelineEventType.PROVIDER_ARRIVED,
    START_SERVICE: TimelineEventType.SERVICE_STARTED,
    COMPLETE_SERVICE: TimelineEventType.SERVICE_COMPLETED,
  } as const;

  await addTimelineEvent({
    bookingId,
    type: typeMap[action],
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });

  if (action === 'PROVIDER_ARRIVE') {
    await stopTrackingOnArrival(bookingId);
  }

  if (action === 'COMPLETE_SERVICE' && booking.payment.status === PaymentStatus.PAY_ON_SERVICE) {
    booking.payment.status = PaymentStatus.PENDING;
    await booking.save();
    scheduleInvoiceGeneration(bookingId);
    void recalculateTrustMetrics(providerId);
    await createAssetServiceRecordFromBooking(bookingId);
    void import('@/modules/trust-protection/guarantee-snapshot.service.js').then((m) =>
      m.captureGuaranteeSnapshot(bookingId),
    );
    void import('@/modules/finance/finance-integration.service.js').then((m) =>
      m.enqueueFinanceOutbox(
        'SERVICE_REVENUE',
        { bookingId },
        `outbox:service-revenue:${bookingId}`,
      ),
    );
    void import('@/modules/customer-lifecycle/lifecycle-feature.service.js').then(async (f) => {
      if (await f.isLifecycleGrowthEnabled()) {
        const loyalty = await import('@/modules/customer-lifecycle/loyalty.service.js');
        const lifecycle = await import('@/modules/customer-lifecycle/lifecycle.service.js');
        await lifecycle.calculateCustomerLifecycle(booking.customerId.toString());
        await loyalty.awardBookingLoyalty(
          bookingId,
          booking.customerId.toString(),
          booking.price?.finalAmount ?? 0,
        );
      }
    });
  } else if (action === 'COMPLETE_SERVICE') {
    scheduleInvoiceGeneration(bookingId);
    void recalculateTrustMetrics(providerId);
    await createAssetServiceRecordFromBooking(bookingId);
    void import('@/modules/trust-protection/guarantee-snapshot.service.js').then((m) =>
      m.captureGuaranteeSnapshot(bookingId),
    );
    void import('@/modules/finance/finance-integration.service.js').then((m) =>
      m.enqueueFinanceOutbox(
        'SERVICE_REVENUE',
        { bookingId },
        `outbox:service-revenue:${bookingId}`,
      ),
    );
    void import('@/modules/customer-lifecycle/lifecycle-feature.service.js').then(async (f) => {
      if (await f.isLifecycleGrowthEnabled()) {
        const loyalty = await import('@/modules/customer-lifecycle/loyalty.service.js');
        const lifecycle = await import('@/modules/customer-lifecycle/lifecycle.service.js');
        await lifecycle.calculateCustomerLifecycle(booking.customerId.toString());
        await loyalty.awardBookingLoyalty(
          bookingId,
          booking.customerId.toString(),
          booking.price?.finalAmount ?? 0,
        );
      }
    });
  }

  await notifyBookingEvent(
    booking.customerId.toString(),
    'BOOKING_STATUS_CHANGED',
    'Booking updated',
    `Booking status: ${booking.status}`,
    bookingId,
  );

  const notifyMap = {
    PROVIDER_EN_ROUTE: {
      type: 'PROVIDER_EN_ROUTE',
      title: 'Professional on the way',
      body: 'Your professional is en route to the service location.',
    },
    PROVIDER_ARRIVE: {
      type: 'PROVIDER_ARRIVED',
      title: 'Professional has arrived',
      body: 'Your professional has arrived at the service location.',
    },
    START_SERVICE: {
      type: 'SERVICE_STARTED',
      title: 'Service started',
      body: 'Your service has started.',
    },
    COMPLETE_SERVICE: {
      type: 'SERVICE_COMPLETED',
      title: 'Service completed',
      body: 'Your service has been completed.',
    },
  } as const;

  const notifyPayload = notifyMap[action];
  if (notifyPayload) {
    await notifyBookingParticipants(
      bookingId,
      notifyPayload.type,
      notifyPayload.title,
      notifyPayload.body,
      booking.homeId?.toString(),
    );
  }

  emitBookingStatusChanged(booking.customerId.toString(), {
    bookingId,
    status: booking.status,
    action,
  });

  return serializeBookingSummary(booking, 'provider');
}

export async function requestReschedule(
  providerId: string,
  bookingId: string,
  proposedStartDateTime: string,
  reason: string,
) {
  const booking = await getOwnedBooking(providerId, bookingId);
  if (booking.reschedule.providerRescheduleCount >= 1) {
    throw new AppError('Provider reschedule limit reached for this booking.', 409, ErrorCode.CONFLICT);
  }

  const proposedStart = new Date(proposedStartDateTime);
  const proposedEnd = addMinutes(proposedStart, booking.durationMinutes);

  const blocks = await getBlockingIntervals(providerId, proposedStart, proposedEnd);
  if (blocks.some((b) => intervalsOverlap(b.start, b.end, proposedStart, proposedEnd))) {
    throw new AppError('That reschedule time is no longer available.', 409, ErrorCode.CONFLICT);
  }

  booking.status = transitionBookingStatus(booking.status, 'RESCHEDULE_REQUEST', UserRole.PROVIDER);
  booking.reschedule.providerRescheduleCount += 1;
  await booking.save();

  await RescheduleRequest.create({
    bookingId,
    providerId,
    originalStart: booking.scheduledStart,
    originalEnd: booking.scheduledEnd,
    proposedStart,
    proposedEnd,
    reason,
    status: RescheduleStatus.PENDING,
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.RESCHEDULE_REQUESTED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { proposedStart: proposedStart.toISOString(), reason },
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'RESCHEDULE_REQUESTED',
    'Reschedule requested',
    'Your professional requested a new appointment time.',
    bookingId,
  );

  return serializeBookingSummary(booking, 'provider');
}

export async function respondToReschedule(customerId: string, bookingId: string, accept: boolean) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const request = await RescheduleRequest.findOne({
    bookingId,
    status: RescheduleStatus.PENDING,
  }).sort({ createdAt: -1 });
  if (!request) throw new AppError('No pending reschedule request.', 404, ErrorCode.NOT_FOUND);

  if (accept) {
    const blocks = await getBlockingIntervals(
      booking.providerId.toString(),
      request.proposedStart,
      request.proposedEnd,
    );
    if (blocks.some((b) => intervalsOverlap(b.start, b.end, request.proposedStart, request.proposedEnd))) {
      throw new AppError('That reschedule time is no longer available.', 409, ErrorCode.CONFLICT);
    }

    booking.scheduledStart = request.proposedStart;
    booking.scheduledEnd = request.proposedEnd;
    booking.status = transitionBookingStatus(booking.status, 'RESCHEDULE_ACCEPT', UserRole.CUSTOMER);
    request.status = RescheduleStatus.ACCEPTED;
    await request.save();
    await booking.save();
    await addTimelineEvent({
      bookingId,
      type: TimelineEventType.RESCHEDULE_ACCEPTED,
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
    });
  } else {
    booking.status = transitionBookingStatus(booking.status, 'RESCHEDULE_REJECT', UserRole.CUSTOMER);
    request.status = RescheduleStatus.REJECTED;
    await request.save();
    await booking.save();
    await addTimelineEvent({
      bookingId,
      type: TimelineEventType.RESCHEDULE_REJECTED,
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
    });
  }

  return serializeBookingDetail(booking, await listTimelineEvents(bookingId), undefined, 'provider');
}

export async function requestPriceChange(
  providerId: string,
  bookingId: string,
  proposedAmount: number,
  reason: string,
  items?: string[],
) {
  const booking = await getOwnedBooking(providerId, bookingId);
  const pending = await PriceChangeRequest.findOne({ bookingId, status: PriceChangeStatus.PENDING });
  if (pending) throw new AppError('A price change request is already pending.', 409, ErrorCode.CONFLICT);

  const currentJobSubtotal =
    booking.price.customerJobSubtotal ??
    booking.price.jobSubtotal ??
    booking.price.baseAmount ??
    booking.price.estimatedAmount;

  const record = await PriceChangeRequest.create({
    bookingId,
    providerId,
    originalAmount: currentJobSubtotal,
    proposedAmount,
    difference: proposedAmount - currentJobSubtotal,
    reason,
    items: items ?? [],
    status: PriceChangeStatus.PENDING,
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.PRICE_CHANGE_REQUESTED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { proposedAmount, reason },
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'PRICE_CHANGE_REQUESTED',
    'Price update requested',
    'Your professional requested a price adjustment.',
    bookingId,
  );

  return record;
}

export async function respondToPriceChange(customerId: string, bookingId: string, accept: boolean) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const request = await PriceChangeRequest.findOne({ bookingId, status: PriceChangeStatus.PENDING });
  if (!request) throw new AppError('No pending price change request.', 404, ErrorCode.NOT_FOUND);

  if (accept) {
    request.status = PriceChangeStatus.APPROVED;
    const urgentSurcharge = booking.price.urgentSurcharge ?? booking.price.visitCharge ?? 0;
    const serviceAmount = Math.max(0, request.proposedAmount - urgentSurcharge);
    const priced = calculateJobPricing({ serviceAmount, urgentSurcharge });
    booking.price.baseAmount = priced.serviceAmount;
    booking.price.urgentSurcharge = priced.urgentSurcharge;
    booking.price.jobSubtotal = priced.jobSubtotal;
    booking.price.customerJobSubtotal = priced.customerJobSubtotal;
    booking.price.platformFeeAmount = priced.platformFee;
    booking.price.providerPayoutAmount = priced.providerPayoutAmount;
    booking.price.finalAmount = priced.finalAmount;
    booking.price.estimatedAmount = priced.finalAmount;
    await booking.save();
    await addTimelineEvent({
      bookingId,
      type: TimelineEventType.PRICE_CHANGE_APPROVED,
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
    });
  } else {
    request.status = PriceChangeStatus.REJECTED;
    await addTimelineEvent({
      bookingId,
      type: TimelineEventType.PRICE_CHANGE_REJECTED,
      actorId: customerId,
      actorRole: UserRole.CUSTOMER,
    });
  }
  await request.save();

  if (booking.providerId) {
    await notifyBookingEvent(
      booking.providerId.toString(),
      accept ? 'PRICE_CHANGE_APPROVED' : 'PRICE_CHANGE_REJECTED',
      accept ? 'Price change approved' : 'Price change rejected',
      accept
        ? 'The customer approved your price change request.'
        : 'The customer rejected your price change request.',
      bookingId,
    );
  }

  return serializeBookingDetail(booking, await listTimelineEvents(bookingId), {
    priceChangeRequest: request,
  }, 'provider');
}

export async function cancelProviderBooking(
  providerId: string,
  bookingId: string,
  reason: string,
) {
  const booking = await getOwnedBooking(providerId, bookingId);

  if (booking.bookingType === BookingType.URGENT && booking.urgentRequestId) {
    const { restartUrgentDispatchAfterProviderCancel } = await import(
      '@/modules/urgent/urgent.service.js'
    );
    const result = await restartUrgentDispatchAfterProviderCancel(bookingId, providerId, reason);
    return {
      redispatch: true,
      urgentRequestId: result.urgentRequest.id,
      cancelledBookingId: result.cancelledBookingId,
    };
  }

  booking.status = transitionBookingStatus(booking.status, 'PROVIDER_CANCEL', UserRole.PROVIDER);
  booking.cancellation = {
    reason,
    actorId: booking.providerId,
    actorRole: UserRole.PROVIDER,
    cancelledAt: new Date(),
  };
  await booking.save();

  await releaseEntitlementForBooking(booking);

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.CANCELLED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { reason },
  });

  emitBookingStatusChanged(booking.customerId.toString(), {
    bookingId,
    status: booking.status,
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'BOOKING_CANCELLED',
    'Booking cancelled',
    reason.trim() || 'Your professional cancelled this booking.',
    bookingId,
  );

  return serializeBookingSummary(booking, 'provider');
}
