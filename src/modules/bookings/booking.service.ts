import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
  BookingStatus,
  BookingType,
  ErrorCode,
  HomeCapability,
  PaymentMethod,
  ProviderRequestStatus,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  TimelineEventType,
  UrgentRequestStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { PriceChangeRequest } from '@/models/PriceChangeRequest.js';
import { PriceChangeStatus } from '@ghaarfix/shared-types';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { customerCompletionOtp } from '@/modules/bookings/service-completion-otp.service.js';
import { customerStartOtp } from '@/modules/bookings/service-start-otp.service.js';
import { resolveBookingSource } from '@/modules/bookings/booking-source.util.js';
import { linkRecurringPlanToConfirmedBooking } from '@/modules/home-help/home-help-recurring.service.js';
import { BookingIdempotency } from '@/models/BookingIdempotency.js';
import { BookingParticipant } from '@/models/BookingParticipant.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { Payment } from '@/models/Payment.js';
import { RewardLedger } from '@/models/RewardLedger.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { User } from '@/models/User.js';
import { transitionBookingStatus } from '@/modules/bookings/booking-status.service.js';
import {
  findAvailableProviderForBooking,
  reassignPendingBookingProvider,
} from '@/modules/bookings/provider-reassignment.service.js';
import { addTimelineEvent, listTimelineEvents } from '@/modules/bookings/timeline.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { broadcastBookingRealtimeUpdate } from '@/modules/realtime/booking-realtime.service.js';
import { emitAvailabilityChanged } from '@/modules/realtime/socket.service.js';
import { getPaymentGateway, initialPaymentStatus } from '@/modules/payments/payment-gateway.js';
import { getBlockingIntervals } from '@/modules/provider-availability/availability.service.js';
import { consumeSlotReservation } from '@/modules/provider-availability/reservation.service.js';
import { getProviderScheduleDocument } from '@/modules/provider-availability/schedule.service.js';
import { providerMatchesAddress } from '@/modules/provider-availability/service-area.service.js';
import { buildAssetSnapshot, validateAssetForService } from '@/modules/home-health/helpers.js';
import { findOrCreateHomeForAddress } from '@/modules/home-health/home.service.js';
import {
  findBookingForCustomer,
  getBookingParticipantSummary,
  seedDefaultParticipants,
} from '@/modules/booking-participants/booking-participant.service.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';
import { logger } from '@/utils/logger.js';
import { generateBookingNumber } from '@/utils/bookingNumber.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { serializeBookingDetail, serializeBookingSummary } from '@/utils/bookingSerializers.js';
import { intervalsOverlap } from '@/utils/intervals.js';
import {
  calculateBookingPrice,
  getEligibleBenefitsForCheckout,
} from '@/modules/care-plans/pricing-engine.service.js';
import { reserveEntitlement } from '@/modules/care-plans/entitlement.service.js';
import { releaseEntitlementForBooking } from '@/modules/care-plans/booking-entitlement.helper.js';
import {
  debitRewardIdempotent,
  getRewardBalance,
  reverseRewardDebit,
} from '@/modules/discovery-growth/growth.service.js';
import { computeCoinRedemption } from '@/modules/discovery-growth/reward-coins.js';
import {
  redeemPromotion,
  validatePromotion,
} from '@/modules/discovery-growth/promotion.service.js';
import type { CreateBookingBody } from '@/validators/booking.js';

async function validateBookingEligibility(
  customerId: string,
  reservation: {
    providerId: { toString(): string };
    serviceId: { toString(): string };
    addressId: { toString(): string };
    startDateTime: Date;
    endDateTime: Date;
  },
) {
  const providerId = reservation.providerId.toString();
  const serviceId = reservation.serviceId.toString();
  const addressId = reservation.addressId.toString();

  const [user, profile, service, providerService, address] = await Promise.all([
    User.findById(providerId),
    ProviderProfile.findOne({ userId: providerId }),
    Service.findOne({ _id: serviceId, isActive: true }),
    ProviderService.findOne({
      providerId,
      serviceId,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
    }),
    CustomerAddress.findOne({ _id: addressId, customerId }),
  ]);

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('This professional is no longer available.', 409, ErrorCode.CONFLICT);
  }
  if (!profile || profile.providerStatus !== ProviderStatus.ACTIVE) {
    throw new AppError('This professional is no longer available.', 409, ErrorCode.CONFLICT);
  }
  if (!service) throw new AppError('Service is no longer available.', 409, ErrorCode.CONFLICT);
  if (!providerService) {
    throw new AppError('Provider does not offer this service.', 409, ErrorCode.CONFLICT);
  }
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  const inArea = await providerMatchesAddress(providerId, address);
  if (!inArea) {
    throw new AppError('Provider does not serve this area.', 409, ErrorCode.CONFLICT);
  }

  const blocks = await getBlockingIntervals(
    providerId,
    reservation.startDateTime,
    reservation.endDateTime,
  );
  if (blocks.some((b) => intervalsOverlap(b.start, b.end, reservation.startDateTime, reservation.endDateTime))) {
    throw new AppError('Another customer just booked this time.', 409, ErrorCode.CONFLICT);
  }

  return { user, profile, service, providerService, address };
}

export async function createBookingFromReservation(
  customerId: string,
  input: CreateBookingBody,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await BookingIdempotency.findOne({ customerId, key: idempotencyKey });
    if (existing?.bookingId) {
      const booking = await Booking.findById(existing.bookingId);
      if (booking) {
        const timeline = await listTimelineEvents(booking._id.toString());
        return serializeBookingDetail(booking, timeline);
      }
    }
  }

  const existingBooking = await Booking.findOne({
    reservationId: new mongoose.Types.ObjectId(input.reservationId),
  });
  if (existingBooking) {
    const timeline = await listTimelineEvents(existingBooking._id.toString());
    return serializeBookingDetail(existingBooking, timeline);
  }

  const reservation = await consumeSlotReservation(input.reservationId, customerId);
  const { profile, service, providerService, address, user } = await validateBookingEligibility(
    customerId,
    reservation,
  );

  let homeId = reservation.homeId?.toString();
  const assetId = reservation.assetId?.toString();
  let assetSnapshot;

  if (assetId) {
    const asset = await validateAssetForService(customerId, reservation.serviceId.toString(), assetId, homeId);
    assetSnapshot = await buildAssetSnapshot(assetId);
    homeId = asset.homeId.toString();
  } else if (!homeId) {
    const home = await findOrCreateHomeForAddress(customerId, reservation.addressId.toString());
    homeId = home?._id.toString();
  }

  const schedule = await getProviderScheduleDocument(reservation.providerId.toString());
  const timezone = schedule?.timezone ?? 'Asia/Kolkata';
  const durationMinutes = Math.round(
    (reservation.endDateTime.getTime() - reservation.startDateTime.getTime()) / 60000,
  );

  let estimatedAmount =
    providerService.customPricing?.enabled && providerService.customPricing.startingPrice != null
      ? providerService.customPricing.startingPrice
      : (service.pricing.startingPrice ?? 0);
  if (reservation.homeHelp?.quotedAmount != null) {
    estimatedAmount = reservation.homeHelp.quotedAmount;
  }
  const visitCharge = providerService.customPricing?.enabled
    ? providerService.customPricing.visitCharge
    : undefined;

  if (input.entitlementId) {
    const eligible = await getEligibleBenefitsForCheckout({
      customerId,
      serviceId: reservation.serviceId.toString(),
      homeId,
      categoryId: service.categoryId?.toString(),
    });
    if (!eligible.some((e) => e.id === input.entitlementId)) {
      throw new AppError('Selected Care Plan benefit is not eligible for this booking.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  let rewardCredit = 0;
  let rewardCoinsToDebit = 0;
  let promotionDiscount = 0;
  let promotionId: string | undefined;

  if (input.promotionCode) {
    const validated = await validatePromotion({
      code: input.promotionCode,
      customerId,
      orderAmount: estimatedAmount,
      serviceId: reservation.serviceId.toString(),
      categoryId: service.categoryId?.toString(),
    });
    promotionDiscount = validated.discountAmount;
    promotionId = validated.promotionId;
  }

  if (input.applyRewardCredit) {
    const balance = await getRewardBalance(customerId);
    const provisional = await calculateBookingPrice({
      baseAmount: estimatedAmount,
      currency: service.pricing.currency ?? 'INR',
      customerId,
      serviceId: reservation.serviceId.toString(),
      categoryId: service.categoryId?.toString(),
      homeId,
      entitlementId: input.entitlementId,
      promotionDiscount,
    });
    const redemption = computeCoinRedemption(balance.balance, provisional.finalAmount);
    rewardCredit = redemption.rupeeDiscount;
    rewardCoinsToDebit = redemption.coinsToDebit;
    if (rewardCredit <= 0) {
      throw new AppError(
        `Need at least ${balance.coinsPerBlock} Ghaarfix coins to save ₹${balance.rupeesPerBlock}.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  const pricing = await calculateBookingPrice({
    baseAmount: estimatedAmount,
    currency: service.pricing.currency ?? 'INR',
    customerId,
    serviceId: reservation.serviceId.toString(),
    categoryId: service.categoryId?.toString(),
    homeId,
    entitlementId: input.entitlementId,
    rewardCredit,
    promotionDiscount,
  });

  const carePlanBenefitLabel = pricing.lineItems.find((l) => l.type === 'SUBSCRIPTION_BENEFIT')?.label;

  const providerResponseExpiresAt = new Date(
    Date.now() + env.booking.providerResponseTimeoutMinutes * 60 * 1000,
  );

  const bookingNumber = await generateBookingNumber();
  const paymentStatus = initialPaymentStatus(input.paymentMethod);

  const booking = await Booking.create({
    bookingNumber,
    bookingType: BookingType.SCHEDULED,
    source: resolveBookingSource({
      quickServices: reservation.quickServices,
      homeHelp: reservation.homeHelp,
    }),
    customerId,
    providerId: reservation.providerId,
    serviceId: reservation.serviceId,
    providerServiceId: providerService._id,
    reservationId: reservation._id,
    addressSnapshot: {
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      location: {
        latitude: address.location.coordinates[1]!,
        longitude: address.location.coordinates[0]!,
      },
    },
    serviceSnapshot: {
      name: service.name,
      shortDescription: service.shortDescription,
      pricing: service.pricing,
    },
    providerSnapshot: {
      fullName: profile.fullName ?? user!.fullName ?? 'Professional',
      profileImage: profile.profileImage ?? user!.profileImage,
      experienceYears: providerService.experienceYears ?? profile.experienceYears,
    },
    status: BookingStatus.PENDING_PROVIDER,
    providerRequestStatus: ProviderRequestStatus.PENDING,
    providerResponseExpiresAt,
    scheduledStart: reservation.startDateTime,
    scheduledEnd: reservation.endDateTime,
    timezone,
    durationMinutes,
    customerNotes: input.customerNotes,
    price: {
      estimatedAmount,
      finalAmount: pricing.finalAmount,
      currency: pricing.currency,
      visitCharge,
      urgentSurcharge: pricing.urgentSurcharge,
      platformFeeAmount: pricing.platformFeeAmount,
      jobSubtotal: pricing.jobSubtotal,
      customerJobSubtotal: pricing.customerJobSubtotal,
      baseAmount: pricing.baseAmount,
      subscriptionBenefitAmount: pricing.subscriptionBenefitAmount,
      promotionDiscount: pricing.promotionDiscount,
      rewardCredit: pricing.rewardCredit,
      providerPayoutAmount: pricing.providerPayoutAmount,
      entitlementId: pricing.entitlementId
        ? new mongoose.Types.ObjectId(pricing.entitlementId)
        : undefined,
      carePlanBenefitLabel,
    },
    payment: {
      method: input.paymentMethod,
      status: paymentStatus,
    },
    homeId: homeId ? new mongoose.Types.ObjectId(homeId) : undefined,
    assetId: assetId ? new mongoose.Types.ObjectId(assetId) : undefined,
    assetSnapshot,
    reschedule: { providerRescheduleCount: 0 },
    homeHelp: reservation.homeHelp
      ? {
          durationPackageId: reservation.homeHelp.durationPackageId,
          durationLabel: reservation.homeHelp.durationLabel,
          durationMinutes: reservation.homeHelp.durationMinutes,
          quotedAmount: reservation.homeHelp.quotedAmount,
          generalNotes: reservation.homeHelp.generalNotes,
          tasks: reservation.homeHelp.tasks.map((task) => ({
            serviceId: task.serviceId,
            name: task.name,
            priority: task.priority,
            notes: task.notes,
          })),
        }
      : undefined,
    quickServices: reservation.quickServices,
  });

  const payment = await Payment.create({
    bookingId: booking._id,
    customerId,
    amount: booking.price.finalAmount,
    currency: booking.price.currency,
    method: input.paymentMethod,
    provider: input.paymentMethod === PaymentMethod.ONLINE ? 'razorpay' : 'internal',
    status: paymentStatus,
  });

  booking.payment.paymentId = payment._id;
  await booking.save();

  if (input.entitlementId) {
    await reserveEntitlement(
      customerId,
      input.entitlementId,
      booking._id.toString(),
      pricing.subscriptionBenefitAmount,
    );
  }

  if (pricing.rewardCredit > 0) {
    await debitRewardIdempotent(
      customerId,
      rewardCoinsToDebit,
      booking._id.toString(),
      `booking-reward-${booking._id.toString()}`,
    );
  }

  if (promotionId && pricing.promotionDiscount > 0) {
    await redeemPromotion(
      promotionId,
      customerId,
      pricing.promotionDiscount,
      booking._id.toString(),
    );
  }

  if (input.paymentMethod === PaymentMethod.ONLINE) {
    if (!env.razorpay.keyId || !env.razorpay.keySecret) {
      throw new AppError(
        'Online payments are not configured. Use Pay After Service or add Razorpay keys on the server.',
        503,
        ErrorCode.PAYMENT_ERROR,
      );
    }
    const gateway = getPaymentGateway();
    const order = await gateway.createPayment({
      amount: booking.price.finalAmount,
      currency: booking.price.currency,
      bookingId: booking._id.toString(),
      customerId,
    });
    payment.providerOrderId = order.orderId;
    payment.metadata = { order };
    await payment.save();
  }

  await addTimelineEvent({
    bookingId: booking._id.toString(),
    type: TimelineEventType.BOOKING_CREATED,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
  });

  await notifyBookingEvent(
    reservation.providerId.toString(),
    'BOOKING_REQUESTED',
    'New booking request',
    `You have a new ${service.name} request.`,
    booking._id.toString(),
  );

  await seedDefaultParticipants(booking._id.toString(), customerId, homeId);

  if (reservation.quickServices?.recurring || reservation.quickServices?.bookingMode === 'recurring') {
    await linkRecurringPlanToConfirmedBooking({
      reservationId: reservation._id.toString(),
      bookingId: booking._id.toString(),
    });
  }

  const participantSummary = await getBookingParticipantSummary(booking._id.toString());
  const serialized = serializeBookingDetail(booking, await listTimelineEvents(booking._id.toString()), {
    participantSummary,
    paymentOrder:
      input.paymentMethod === PaymentMethod.ONLINE ? payment.metadata?.order : undefined,
  });

  if (idempotencyKey) {
    await BookingIdempotency.findOneAndUpdate(
      { customerId, key: idempotencyKey },
      { bookingId: booking._id, response: serialized },
      { upsert: true },
    );
  }

  const bookingId = booking._id.toString();
  broadcastBookingRealtimeUpdate(
    {
      bookingId,
      status: booking.status,
      action: 'CREATED',
      providerId: reservation.providerId.toString(),
      customerId,
    },
    {
      customerId,
      providerId: reservation.providerId.toString(),
    },
  );

  const scheduleDoc = await getProviderScheduleDocument(reservation.providerId.toString());
  const bookingTimezone = scheduleDoc?.timezone ?? 'Asia/Kolkata';
  const bookingDate = DateTime.fromJSDate(booking.scheduledStart, { zone: 'utc' })
    .setZone(bookingTimezone)
    .toISODate()!;
  emitAvailabilityChanged(reservation.providerId.toString(), bookingDate, {
    startDateTime: booking.scheduledStart.toISOString(),
    reason: 'booking',
  });

  return serialized;
}

export async function listCustomerBookings(
  customerId: string,
  query: { page: number; limit: number; tab?: string },
) {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);
  const participantBookingIds = await BookingParticipant.find({ customerId: customerObjectId }).distinct(
    'bookingId',
  );
  const filter: Record<string, unknown> = {
    $or: [{ customerId: customerObjectId }, { _id: { $in: participantBookingIds } }],
  };
  const now = new Date();
  const tab = query.tab === 'completed' ? 'past' : query.tab;

  if (tab === 'upcoming') {
    filter.status = {
      $in: [
        BookingStatus.PENDING_PROVIDER,
        BookingStatus.CONFIRMED,
        BookingStatus.PROVIDER_EN_ROUTE,
        BookingStatus.PROVIDER_ARRIVED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.RESCHEDULE_REQUESTED,
      ],
    };
    filter.scheduledStart = { $gte: now };
  } else if (tab === 'in_progress') {
    filter.status = {
      $in: [
        BookingStatus.PROVIDER_EN_ROUTE,
        BookingStatus.PROVIDER_ARRIVED,
        BookingStatus.IN_PROGRESS,
      ],
    };
  } else if (tab === 'past') {
    filter.status = BookingStatus.COMPLETED;
  } else if (tab === 'cancelled') {
    filter.status = BookingStatus.CANCELLED;
  }

  const total = await Booking.countDocuments(filter);
  const items = await Booking.find(filter)
    .sort({ scheduledStart: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  return {
    items: items.map((booking) => serializeBookingSummary(booking)),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getCustomerBooking(customerId: string, bookingId: string) {
  const booking = await findBookingForCustomer(customerId, bookingId);
  if (
    booking.status === BookingStatus.IN_PROGRESS ||
    booking.status === BookingStatus.PROVIDER_ARRIVED
  ) {
    const withOtp = await Booking.findById(bookingId).select(
      '+tracking.serviceCompletionOtp +tracking.serviceStartOtp',
    );
    if (withOtp?.tracking) {
      booking.tracking = withOtp.tracking;
    }
  }
  const timeline = await listTimelineEvents(bookingId);
  const participantSummary = await getBookingParticipantSummary(bookingId);
  const serviceCompletionOtp = customerCompletionOtp(booking);
  const serviceStartOtp = customerStartOtp(booking);

  let noShowEligibleAt: string | undefined;
  if (
    booking.bookingType === BookingType.URGENT &&
    [BookingStatus.CONFIRMED, BookingStatus.PROVIDER_EN_ROUTE, BookingStatus.PROVIDER_ARRIVED].includes(
      booking.status,
    )
  ) {
    const { getDispatchConfig } = await import('@/modules/urgent/urgent-config.service.js');
    const dispatchConfig = await getDispatchConfig();
    const baseTime = booking.createdAt ?? booking.updatedAt;
    noShowEligibleAt = new Date(
      baseTime.getTime() + dispatchConfig.noShowMinutes * 60 * 1000,
    ).toISOString();
  }
  const pendingPriceChange = await PriceChangeRequest.findOne({
    bookingId,
    status: PriceChangeStatus.PENDING,
  });

  let providerContact: { phone: string } | undefined;
  const contactStatuses = new Set([
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_EN_ROUTE,
    BookingStatus.PROVIDER_ARRIVED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
  ]);
  if (booking.providerId && contactStatuses.has(booking.status)) {
    const providerUser = await User.findById(booking.providerId).select('phone');
    if (providerUser?.phone) {
      providerContact = { phone: providerUser.phone };
    }
  }

  return serializeBookingDetail(booking, timeline, {
    participantSummary,
    serviceCompletionOtp,
    serviceStartOtp,
    noShowEligibleAt,
    providerRequestExpiredAt: booking.providerRequestExpiredAt?.toISOString(),
    providerConfirmation: booking.providerConfirmation
      ? {
          status: booking.providerConfirmation.status,
          confirmedAt: booking.providerConfirmation.confirmedAt?.toISOString(),
        }
      : undefined,
    providerContact,
    priceChangeRequest: pendingPriceChange
      ? {
          id: pendingPriceChange._id.toString(),
          originalAmount: pendingPriceChange.originalAmount,
          proposedAmount: pendingPriceChange.proposedAmount,
          difference: pendingPriceChange.difference,
          reason: pendingPriceChange.reason,
          items: pendingPriceChange.items,
          status: pendingPriceChange.status,
          createdAt: pendingPriceChange.createdAt.toISOString(),
        }
      : undefined,
  });
}

export async function cancelCustomerBooking(customerId: string, bookingId: string, reason: string) {
  const booking = await findBookingForCustomer(customerId, bookingId);
  if (booking.customerId.toString() !== customerId) {
    if (!booking.homeId) {
      throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
    }
    await assertHomeCapability(customerId, booking.homeId.toString(), HomeCapability.BOOKING_CANCEL);
  }

  const next = transitionBookingStatus(booking.status, 'CUSTOMER_CANCEL', UserRole.CUSTOMER);
  booking.status = next;
  booking.cancellation = { reason, actorId: booking.customerId, actorRole: UserRole.CUSTOMER, cancelledAt: new Date() };
  if (booking.providerRequestStatus === ProviderRequestStatus.PENDING) {
    booking.providerRequestStatus = ProviderRequestStatus.EXPIRED;
  }
  await booking.save();

  await releaseEntitlementForBooking(booking);
  if (booking.price.rewardCredit && booking.price.rewardCredit > 0) {
    const debitEntry = await RewardLedger.findOne({
      sourceId: booking._id.toString(),
      idempotencyKey: `booking-reward-${booking._id.toString()}`,
    });
    await reverseRewardDebit(
      customerId,
      booking._id.toString(),
      debitEntry?.amount ?? booking.price.rewardCredit,
    );
  }

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.CANCELLED,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
    metadata: { reason },
  });

  broadcastBookingRealtimeUpdate(
    {
      bookingId,
      status: booking.status,
      action: 'CANCELLED',
      customerId,
      providerId: booking.providerId?.toString(),
    },
    {
      customerId,
      providerId: booking.providerId?.toString(),
    },
  );

  return serializeBookingSummary(booking);
}

export async function expirePendingProviderRequests() {
  const now = new Date();
  const bookings = await Booking.find({
    status: BookingStatus.PENDING_PROVIDER,
    providerRequestStatus: ProviderRequestStatus.PENDING,
    providerResponseExpiresAt: { $lte: now },
    providerRequestExpiredAt: { $exists: false },
  }).limit(100);

  let expired = 0;
  for (const booking of bookings) {
    booking.providerRequestExpiredAt = now;
    await booking.save();

    await addTimelineEvent({
      bookingId: booking._id.toString(),
      type: TimelineEventType.PROVIDER_REQUEST_EXPIRED,
      actorRole: UserRole.ADMIN,
      metadata: { providerId: booking.providerId.toString() },
    });

    await notifyBookingEvent(
      booking.customerId.toString(),
      'PROVIDER_REQUEST_EXPIRED',
      'Professional has not responded',
      `${booking.providerSnapshot.fullName} has not accepted yet. You can wait, find another professional, or cancel.`,
      booking._id.toString(),
    );

    broadcastBookingRealtimeUpdate(
      {
        bookingId: booking._id.toString(),
        status: booking.status,
        action: 'UPDATED',
        customerId: booking.customerId.toString(),
        providerId: booking.providerId.toString(),
      },
      {
        customerId: booking.customerId.toString(),
        providerId: booking.providerId.toString(),
      },
    );

    expired += 1;
  }

  return expired;
}

export async function waitForProviderResponse(customerId: string, bookingId: string) {
  const booking = await findBookingForCustomer(customerId, bookingId);
  if (booking.status !== BookingStatus.PENDING_PROVIDER) {
    throw new AppError('This booking is no longer waiting for acceptance.', 409, ErrorCode.CONFLICT);
  }
  if (!booking.providerRequestExpiredAt) {
    throw new AppError('You can extend the wait after the response window expires.', 409, ErrorCode.CONFLICT);
  }

  const waitCount = booking.providerResponseWaitCount ?? 0;
  if (waitCount >= 2) {
    throw new AppError('Maximum wait extensions reached. Please find another professional or cancel.', 409, ErrorCode.CONFLICT);
  }

  booking.providerResponseExpiresAt = new Date(
    Date.now() + env.booking.providerResponseTimeoutMinutes * 60 * 1000,
  );
  booking.providerRequestExpiredAt = undefined;
  booking.providerResponseWaitCount = waitCount + 1;
  await booking.save();

  await notifyBookingEvent(
    customerId,
    'PROVIDER_WAIT_EXTENDED',
    'Waiting a little longer',
    `We gave ${booking.providerSnapshot.fullName} more time to accept your booking.`,
    bookingId,
  );

  return getCustomerBooking(customerId, bookingId);
}

export async function findAnotherProviderForBooking(
  customerId: string,
  bookingId: string,
  preferredProviderId?: string,
) {
  const booking = await findBookingForCustomer(customerId, bookingId);
  if (booking.status !== BookingStatus.PENDING_PROVIDER) {
    throw new AppError('This booking is no longer waiting for acceptance.', 409, ErrorCode.CONFLICT);
  }

  const newProviderId =
    preferredProviderId ?? (await findAvailableProviderForBooking(booking));
  if (!newProviderId) {
    throw new AppError('No alternate professionals are available right now.', 409, ErrorCode.CONFLICT);
  }

  const reassigned = await reassignPendingBookingProvider(
    booking,
    newProviderId,
    'customer-requested-replacement',
  );
  if (!reassigned) {
    throw new AppError('Could not assign another professional.', 409, ErrorCode.CONFLICT);
  }

  return getCustomerBooking(customerId, bookingId);
}

/**
 * No-show / unreachable resolution for URGENT bookings.
 *
 * A customer can escalate when their assigned provider is taking too long to
 * arrive (or never shows up). We validate ownership, urgent type, current state
 * and an elapsed-time threshold (configurable via URGENT_NO_SHOW_MINUTES), then:
 *
 * 1. Cancel the current booking (actor = CUSTOMER, reason stored).
 * 2. Release the assigned provider.
 * 3. Reset the linked UrgentRequest back to SEARCHING.
 * 4. Restart dispatch waves (previously-failed provider is excluded).
 * 5. Notify the customer that we are finding another professional.
 *
 * This mirrors provider-cancel redispatch but is customer-initiated and gated
 * by the no-show time window so it cannot be abused to cancel for free.
 */
export async function redispatchAfterNoShow(
  customerId: string,
  bookingId: string,
  reason: string,
) {
  const booking = await findBookingForCustomer(customerId, bookingId);

  if (booking.bookingType !== BookingType.URGENT || !booking.urgentRequestId) {
    throw new AppError('Only urgent bookings support no-show re-dispatch.', 409, ErrorCode.CONFLICT);
  }

  const noShowStatuses = [
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_EN_ROUTE,
    BookingStatus.PROVIDER_ARRIVED,
  ];
  if (!noShowStatuses.includes(booking.status)) {
    throw new AppError(
      'This job cannot be re-dispatched in its current state.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  // Elapsed-time gate: only allow escalation after the provider has had a
  // reasonable window to reach the customer. Prevents unlimited free cancels.
  // The booking is created at the moment of assignment, so createdAt is the
  // assignment time for urgent bookings.
  const acceptedAt = booking.createdAt ?? booking.updatedAt;
  const elapsedMs = Date.now() - new Date(acceptedAt).getTime();
  const { getDispatchConfig } = await import('@/modules/urgent/urgent-config.service.js');
  const dispatchConfig = await getDispatchConfig();
  const noShowWindowMs = dispatchConfig.noShowMinutes * 60 * 1000;
  if (elapsedMs < noShowWindowMs) {
    const remainingMin = Math.ceil((noShowWindowMs - elapsedMs) / 60000);
    throw new AppError(
      `You can escalate after ${remainingMin} more minute(s).`,
      409,
      ErrorCode.CONFLICT,
    );
  }

  const request = await UrgentRequest.findById(booking.urgentRequestId);
  if (!request) {
    throw new AppError('Linked urgent request not found.', 404, ErrorCode.NOT_FOUND);
  }
  const redispatcheableStatuses = [
    UrgentRequestStatus.ASSIGNED,
    UrgentRequestStatus.CONVERTED_TO_BOOKING,
  ];
  if (!redispatcheableStatuses.includes(request.status)) {
    throw new AppError('This urgent request is no longer re-dispatched.', 409, ErrorCode.CONFLICT);
  }

  // 1. Cancel the current booking atomically (in case the provider just acted).
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    {
      $set: {
        status: BookingStatus.CANCELLED,
        cancellation: {
          reason: `No-show: ${reason}`,
          actorId: customerId,
          actorRole: UserRole.CUSTOMER,
          cancelledAt: new Date(),
        },
      },
    },
    { new: true },
  );
  if (!claimed) {
    throw new AppError('Booking status changed; please retry.', 409, ErrorCode.CONFLICT);
  }

  await releaseEntitlementForBooking(claimed);

  await addTimelineEvent({
    bookingId: claimed._id.toString(),
    type: TimelineEventType.CANCELLED,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
    metadata: { reason: `no-show: ${reason}`, redispatch: true },
  });

  const { resetUrgentRequestForRedispatch } = await import(
    '@/modules/urgent/urgent-redispatch.service.js'
  );
  await resetUrgentRequestForRedispatch({
    request,
    rejectedProviderId: claimed.providerId.toString(),
    customerId,
    resetEligiblePool: false,
  });

  const { setProviderOnline } = await import('@/modules/presence/presence.service.js');
  await setProviderOnline(claimed.providerId.toString());

  broadcastBookingRealtimeUpdate(
    {
      bookingId: claimed._id.toString(),
      status: BookingStatus.CANCELLED,
      action: 'CANCELLED',
      customerId,
      providerId: claimed.providerId.toString(),
    },
    {
      customerId,
      providerId: claimed.providerId.toString(),
    },
  );

  await notifyBookingEvent(
    customerId,
    'BOOKING_CANCELLED',
    'Finding another professional',
    'Your professional did not arrive on time. We are searching for someone else nearby.',
    claimed._id.toString(),
  );

  logger.info('urgent no-show redispatch started', {
    bookingId: claimed._id.toString(),
    urgentRequestId: request._id.toString(),
    customerId,
    previousProviderId: claimed.providerId.toString(),
  });

  return {
    redispatch: true,
    urgentRequestId: request._id.toString(),
    cancelledBookingId: claimed._id.toString(),
  };
}
