import {
  ACTIVE_URGENT_REQUEST_STATUSES,
  BookingStatus,
  BookingType,
  ErrorCode,
  PaymentMethod,
  ProviderRequestStatus,
  TimelineEventType,
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { Payment } from '@/models/Payment.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentIdempotency } from '@/models/UrgentIdempotency.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { calculateJobPricing, calculateUrgentSurcharge } from '@/modules/bookings/booking-pricing.service.js';
import { initialPaymentStatus } from '@/modules/payments/payment-gateway.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import {
  emitBookingStatusChanged,
  emitUrgentCancelled,
  emitUrgentExpired,
  emitUrgentRequestClosed,
  emitToAdmin,
  emitToProvider,
} from '@/modules/realtime/socket.service.js';
import { startUrgentSearchWaves, stopUrgentSearchWaves } from '@/modules/urgent/urgent-wave.service.js';
import { AppError } from '@/utils/AppError.js';
import { logger } from '@/utils/logger.js';
import { generateBookingNumber } from '@/utils/bookingNumber.js';
import {
  serializeUrgentRequestDetail,
  serializeUrgentRequestSummary,
} from '@/utils/urgentSerializers.js';
import { generateUrgentRequestNumber } from '@/utils/urgentNumber.js';
import { resolveBookingSource } from '@/modules/bookings/booking-source.util.js';
import type { CreateUrgentRequestBody } from '@/validators/urgent.js';
import type { ServiceUrgentConfig } from '@/models/Service.js';

const DEFAULT_URGENT_CONFIG: ServiceUrgentConfig = {
  enabled: true,
  baseFee: 99,
  extraFee: 50,
  responseTimeoutMinutes: 5,
  maxProviderDistanceKm: 15,
  maxBroadcastProviders: 10,
};

export function resolveUrgentConfig(service: {
  urgentConfig?: Partial<ServiceUrgentConfig>;
}): ServiceUrgentConfig {
  const config = service.urgentConfig;
  if (config?.enabled) {
    return {
      enabled: true,
      baseFee: config.baseFee ?? DEFAULT_URGENT_CONFIG.baseFee,
      extraFee: config.extraFee ?? DEFAULT_URGENT_CONFIG.extraFee,
      responseTimeoutMinutes:
        config.responseTimeoutMinutes ?? DEFAULT_URGENT_CONFIG.responseTimeoutMinutes,
      maxProviderDistanceKm:
        config.maxProviderDistanceKm ?? DEFAULT_URGENT_CONFIG.maxProviderDistanceKm,
      maxBroadcastProviders:
        config.maxBroadcastProviders ?? DEFAULT_URGENT_CONFIG.maxBroadcastProviders,
    };
  }
  return { ...DEFAULT_URGENT_CONFIG, enabled: false };
}

export function calculateUrgentPricing(
  service: {
    pricing: { startingPrice?: number; currency: string };
  },
  urgentConfig: ServiceUrgentConfig,
  baseAmountOverride?: number,
) {
  const baseAmount = baseAmountOverride ?? service.pricing.startingPrice ?? 0;
  const urgentFee = calculateUrgentSurcharge(urgentConfig.baseFee + urgentConfig.extraFee);
  const priced = calculateJobPricing({ serviceAmount: baseAmount, urgentSurcharge: urgentFee });
  return {
    baseAmount,
    urgentFee,
    jobSubtotal: priced.jobSubtotal,
    platformFee: priced.platformFee,
    providerPayoutAmount: priced.providerPayoutAmount,
    estimatedTotal: priced.finalAmount,
    currency: service.pricing.currency,
    pricingVersion: 2,
  };
}

async function dispatchUrgentRequest(request: InstanceType<typeof UrgentRequest>, _serviceName: string) {
  await startUrgentSearchWaves(request._id.toString());
  return serializeUrgentRequestSummary(request);
}

export async function createUrgentRequest(
  customerId: string,
  input: CreateUrgentRequestBody,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await UrgentIdempotency.findOne({ customerId, key: idempotencyKey });
    if (existing?.urgentRequestId) {
      const request = await UrgentRequest.findById(existing.urgentRequestId);
      if (request) return serializeUrgentRequestSummary(request);
    }
  }

  const active = await UrgentRequest.findOne({
    customerId,
    status: { $in: ACTIVE_URGENT_REQUEST_STATUSES },
  });
  if (active) {
    return serializeUrgentRequestSummary(active);
  }

  const [service, address] = await Promise.all([
    input.serviceId
      ? Service.findOne({ _id: input.serviceId, isActive: true })
      : Service.findOne({ isActive: true, 'urgentConfig.enabled': true }).sort({ displayOrder: 1 }),
    CustomerAddress.findOne({ _id: input.addressId, customerId }),
  ]);

  if (!service) {
    throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (!service.isUrgentAvailable || !service.urgentConfig?.enabled) {
    throw new AppError(
      'Urgent service is not available for this service.',
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }
  const urgentConfig = resolveUrgentConfig(service);
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);
  if (!address.location?.coordinates?.length) {
    throw new AppError('Address coordinates are required for urgent requests.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const [lng, lat] = address.location.coordinates;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new AppError('Invalid address coordinates.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const pricing = calculateUrgentPricing(service, urgentConfig);
  const timeoutSeconds = urgentConfig.responseTimeoutMinutes * 60;
  const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

  const request = await UrgentRequest.create({
    requestNumber: await generateUrgentRequestNumber(),
    customerId,
    serviceId: service._id,
    addressSnapshot: {
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      location: { latitude: lat, longitude: lng },
    },
    location: { type: 'Point', coordinates: [lng, lat] },
    customerNotes: input.notes,
    customServiceName: input.customServiceName,
    quickServices: input.quickServices,
    status: UrgentRequestStatus.SEARCHING,
    paymentMethod: input.paymentMethod,
    pricing,
    searchConfig: {
      maxDistanceKm: urgentConfig.maxProviderDistanceKm,
      maxBroadcastProviders: Math.min(
        urgentConfig.maxBroadcastProviders,
        env.urgent.maxBroadcastProviders,
      ),
      broadcastCount: 0,
    },
    expiresAt,
  });

  if (idempotencyKey) {
    await UrgentIdempotency.findOneAndUpdate(
      { customerId, key: idempotencyKey },
      { urgentRequestId: request._id },
      { upsert: true },
    );
  }

  return dispatchUrgentRequest(request, input.customServiceName ?? service.name);
}

export async function getUrgentRequest(customerId: string, requestId: string) {
  const request = await UrgentRequest.findOne({ _id: requestId, customerId });
  if (!request) throw new AppError('Urgent request not found.', 404, ErrorCode.NOT_FOUND);
  const service = await Service.findById(request.serviceId).select('name');
  let providerName: string | undefined;
  let provider:
    | { fullName?: string; profileImage?: string; experienceYears?: number; phone?: string }
    | undefined;
  if (request.providerId) {
    const [profile, user] = await Promise.all([
      ProviderProfile.findOne({ userId: request.providerId }).select(
        'fullName profileImage experienceYears',
      ),
      import('@/models/User.js').then((m) => m.User.findById(request.providerId).select('phone')),
    ]);
    providerName = profile?.fullName;
    provider = {
      fullName: profile?.fullName,
      profileImage: profile?.profileImage,
      experienceYears: profile?.experienceYears,
      phone: user?.phone,
    };
  }
  return serializeUrgentRequestDetail(request, {
    serviceName: request.customServiceName ?? service?.name,
    providerName,
    provider,
  });
}

export async function getActiveUrgentRequest(customerId: string) {
  const request = await UrgentRequest.findOne({
    customerId,
    status: { $in: ACTIVE_URGENT_REQUEST_STATUSES },
  }).sort({ createdAt: -1 });
  if (!request) return null;
  return serializeUrgentRequestSummary(request);
}

export async function cancelUrgentRequest(customerId: string, requestId: string, reason?: string) {
  const cancelled = await UrgentRequest.findOneAndUpdate(
    {
      _id: requestId,
      customerId,
      status: UrgentRequestStatus.SEARCHING,
    },
    {
      $set: {
        status: UrgentRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellation: { reason, actorId: customerId, actorRole: UserRole.CUSTOMER },
      },
    },
    { new: true },
  );

  if (!cancelled) {
    const existing = await UrgentRequest.findOne({ _id: requestId, customerId });
    if (!existing) throw new AppError('Urgent request not found.', 404, ErrorCode.NOT_FOUND);
    throw new AppError('This urgent request can no longer be cancelled.', 409, ErrorCode.CONFLICT);
  }

  stopUrgentSearchWaves(requestId);
  logger.info('urgent search cancelled by customer', {
    urgentRequestId: cancelled._id.toString(),
    customerId,
    reason: reason ?? null,
  });

  await UrgentDispatchTarget.updateMany(
    { urgentRequestId: cancelled._id, status: { $nin: [UrgentDispatchTargetStatus.REJECTED] } },
    { status: UrgentDispatchTargetStatus.EXPIRED, respondedAt: new Date() },
  );

  const targets = await UrgentDispatchTarget.find({ urgentRequestId: cancelled._id });
  for (const target of targets) {
    emitUrgentRequestClosed(target.providerId.toString(), {
      urgentRequestId: cancelled._id.toString(),
      reason: 'cancelled',
    });
  }

  emitUrgentCancelled(customerId, serializeUrgentRequestSummary(cancelled));
  return serializeUrgentRequestSummary(cancelled);
}

export async function expireUrgentRequests(): Promise<number> {
  const now = new Date();
  const expired = await UrgentRequest.find({
    status: UrgentRequestStatus.SEARCHING,
    expiresAt: { $lte: now },
  }).limit(50);

  for (const request of expired) {
    stopUrgentSearchWaves(request._id.toString());
    request.status = UrgentRequestStatus.EXPIRED;
    await request.save();
    await UrgentDispatchTarget.updateMany(
      { urgentRequestId: request._id },
      { status: UrgentDispatchTargetStatus.EXPIRED, respondedAt: now },
    );
    const targets = await UrgentDispatchTarget.find({ urgentRequestId: request._id });
    for (const target of targets) {
      emitUrgentRequestClosed(target.providerId.toString(), {
        urgentRequestId: request._id.toString(),
        reason: 'expired',
      });
    }
    emitUrgentExpired(request.customerId.toString(), serializeUrgentRequestSummary(request));
  }

  return expired.length;
}

export async function convertUrgentToBooking(
  request: InstanceType<typeof UrgentRequest>,
  providerId: string,
): Promise<InstanceType<typeof Booking>> {
  const existing = await Booking.findOne({ urgentRequestId: request._id });
  if (existing) return existing;

  const [service, providerService, profile] = await Promise.all([
    Service.findById(request.serviceId),
    ProviderService.findOne({ providerId, serviceId: request.serviceId }),
    ProviderProfile.findOne({ userId: providerId }),
  ]);

  if (!service || !providerService || !profile) {
    throw new AppError('Unable to convert urgent request to booking.', 500, ErrorCode.INTERNAL_ERROR);
  }

  const now = new Date();
  const durationMinutes = request.homeHelp?.durationMinutes ?? service.estimatedDuration.maxMinutes;
  const scheduledEnd = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const paymentStatus = initialPaymentStatus(request.paymentMethod);
  const estimatedTotal = request.homeHelp?.quotedAmount ?? request.pricing.estimatedTotal;

  const booking = await Booking.create({
    bookingNumber: await generateBookingNumber(),
    bookingType: BookingType.URGENT,
    source: resolveBookingSource({
      quickServices: request.quickServices,
      homeHelp: request.homeHelp,
      urgent: true,
    }),
    customerId: request.customerId,
    providerId,
    serviceId: request.serviceId,
    providerServiceId: providerService._id,
    urgentRequestId: request._id,
    addressSnapshot: request.addressSnapshot,
    serviceSnapshot: {
      name: service.name,
      shortDescription: service.shortDescription,
      pricing: service.pricing,
    },
    providerSnapshot: {
      fullName: profile.fullName,
      profileImage: profile.profileImage,
      experienceYears: profile.experienceYears,
    },
    status: BookingStatus.CONFIRMED,
    providerRequestStatus: ProviderRequestStatus.ACCEPTED,
    scheduledStart: now,
    scheduledEnd,
    timezone: 'Asia/Kolkata',
    durationMinutes,
    customerNotes: request.customerNotes,
    price: {
      estimatedAmount: estimatedTotal,
      finalAmount: estimatedTotal,
      currency: request.pricing.currency,
      baseAmount: request.pricing.baseAmount,
      urgentSurcharge: request.pricing.urgentFee,
      visitCharge: request.pricing.urgentFee,
      jobSubtotal: request.pricing.jobSubtotal,
      platformFeeAmount: request.pricing.platformFee,
      customerJobSubtotal: request.pricing.jobSubtotal,
      providerPayoutAmount: request.pricing.providerPayoutAmount,
    },
    payment: {
      method: request.paymentMethod as PaymentMethod,
      status: paymentStatus,
    },
    reschedule: { providerRescheduleCount: 0 },
    homeHelp: request.homeHelp
      ? {
          durationPackageId: request.homeHelp.durationPackageId,
          durationLabel: request.homeHelp.durationLabel,
          durationMinutes: request.homeHelp.durationMinutes,
          quotedAmount: request.homeHelp.quotedAmount,
          generalNotes: request.homeHelp.generalNotes,
          tasks: request.homeHelp.tasks.map((task) => ({
            serviceId: task.serviceId,
            name: task.name,
            priority: task.priority,
            notes: task.notes,
          })),
        }
      : undefined,
    quickServices: request.quickServices,
  });

  const payment = await Payment.create({
    bookingId: booking._id,
    customerId: request.customerId,
    amount: request.pricing.estimatedTotal,
    currency: request.pricing.currency,
    method: request.paymentMethod,
    status: paymentStatus,
    provider: env.razorpay.keyId ? 'razorpay' : 'dev',
  });

  booking.payment.paymentId = payment._id;
  await booking.save();

  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.BOOKING_CREATED,
    actorId: request.customerId.toString(),
    actorRole: UserRole.CUSTOMER,
  });
  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.URGENT_PROVIDER_ASSIGNED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });
  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.BOOKING_CONFIRMED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });

  request.status = UrgentRequestStatus.CONVERTED_TO_BOOKING;
  request.bookingId = booking._id;
  request.completedAt = now;
  await request.save();

  return booking;
}

const URGENT_REDEPLOY_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PROVIDER_EN_ROUTE,
];

/**
 * When a provider cancels an accepted urgent job before service starts,
 * cancel the booking and restart dispatch for the original urgent request.
 */
export async function restartUrgentDispatchAfterProviderCancel(
  bookingId: string,
  providerId: string,
  reason: string,
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (booking.bookingType !== BookingType.URGENT || !booking.urgentRequestId) {
    throw new AppError('Only urgent bookings support provider re-dispatch.', 409, ErrorCode.CONFLICT);
  }
  if (!URGENT_REDEPLOY_STATUSES.includes(booking.status)) {
    throw new AppError(
      'This job can no longer be cancelled for re-dispatch.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const request = await UrgentRequest.findById(booking.urgentRequestId);
  if (!request) {
    throw new AppError('Linked urgent request not found.', 404, ErrorCode.NOT_FOUND);
  }

  booking.status = BookingStatus.CANCELLED;
  booking.cancellation = {
    reason,
    actorId: booking.providerId,
    actorRole: UserRole.PROVIDER,
    cancelledAt: new Date(),
  };
  await booking.save();

  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.CANCELLED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { reason, redispatch: true },
  });

  const service = await Service.findById(request.serviceId).select('urgentConfig');
  const urgentConfig = resolveUrgentConfig(service ?? {});
  const timeoutSeconds = urgentConfig.responseTimeoutMinutes * 60;
  const freshExpiry = new Date(Date.now() + timeoutSeconds * 1000);
  const { resetUrgentRequestForRedispatch } = await import(
    '@/modules/urgent/urgent-redispatch.service.js'
  );
  await resetUrgentRequestForRedispatch({
    request,
    rejectedProviderId: providerId,
    customerId: booking.customerId.toString(),
    expiresAt: request.expiresAt > freshExpiry ? request.expiresAt : freshExpiry,
  });

  const { setProviderOnline } = await import('@/modules/presence/presence.service.js');
  await setProviderOnline(providerId);

  emitBookingStatusChanged(booking.customerId.toString(), {
    bookingId: booking._id.toString(),
    status: BookingStatus.CANCELLED,
  });
  emitToProvider(providerId, 'booking:status-changed', {
    bookingId: booking._id.toString(),
    status: BookingStatus.CANCELLED,
  });

  await createNotification({
    userId: booking.customerId.toString(),
    type: 'URGENT_PROVIDER_CANCELLED',
    title: 'Finding another professional',
    body: 'Your professional had to cancel. We are searching for someone else nearby.',
    data: { urgentRequestId: request._id.toString(), bookingId: booking._id.toString() },
  });

  emitToAdmin('urgent:updated', { id: request._id.toString(), status: request.status });

  logger.info('urgent redispatch started after provider cancel', {
    bookingId: booking._id.toString(),
    urgentRequestId: request._id.toString(),
    providerId,
  });

  return {
    urgentRequest: serializeUrgentRequestSummary(request),
    cancelledBookingId: booking._id.toString(),
  };
}
