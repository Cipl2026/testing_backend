import {
  BookingStatus,
  BookingType,
  ErrorCode,
  PaymentStatus,
  TimelineEventType,
  TrackingState,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ServiceCompletion } from '@/models/ServiceCompletion.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { scheduleInvoiceGeneration } from '@/modules/invoices/invoice.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { awardBookingRewardCoins, awardReferrerBookingCoins, processReferralQualifications } from '@/modules/discovery-growth/growth.service.js';
import { emitBookingServiceCompleted } from '@/modules/realtime/socket.service.js';
import { recalculateTrustMetrics } from '@/modules/trust/trust-metrics.service.js';
import { AppError } from '@/utils/AppError.js';

export async function submitCompletionSummary(
  providerId: string,
  bookingId: string,
  input: {
    summary: string;
    parts?: Array<{ name: string; quantity: number; amount: number }>;
    recommendations?: string;
    checklist: {
      serviceCompleted: boolean;
      workAreaCleaned: boolean;
      customerInformed: boolean;
      photosAttached: boolean;
    };
  },
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (![BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(booking.status)) {
    throw new AppError('Completion summary only allowed during or after service.', 409, ErrorCode.CONFLICT);
  }

  const existing = await ServiceCompletion.findOne({ bookingId });
  if (existing) {
    return serializeCompletion(existing);
  }

  const completion = await ServiceCompletion.create({
    bookingId,
    providerId,
    summary: input.summary,
    parts: input.parts ?? [],
    recommendations: input.recommendations,
    checklist: input.checklist,
    declaredAt: new Date(),
  });

  return serializeCompletion(completion);
}

export async function completeBookingWithSummary(
  providerId: string,
  bookingId: string,
  input: {
    summary: string;
    parts?: Array<{ name: string; quantity: number; amount: number }>;
    recommendations?: string;
    checklist: {
      serviceCompleted: boolean;
      workAreaCleaned: boolean;
      customerInformed: boolean;
      photosAttached: boolean;
    };
  },
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (booking.status === BookingStatus.COMPLETED) {
    const existing = await ServiceCompletion.findOne({ bookingId });
    return { booking: booking.toObject(), completion: existing ? serializeCompletion(existing) : null };
  }

  if (booking.status !== BookingStatus.IN_PROGRESS) {
    throw new AppError('Service must be in progress to complete.', 409, ErrorCode.CONFLICT);
  }

  await submitCompletionSummary(providerId, bookingId, input);

  booking.status = BookingStatus.COMPLETED;
  if (booking.payment.status === PaymentStatus.PAY_ON_SERVICE) {
    booking.payment.status = PaymentStatus.PENDING;
  }
  booking.tracking = {
    ...booking.tracking,
    state: TrackingState.COMPLETED,
  };
  await booking.save();

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.SERVICE_COMPLETED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
  });

  await notifyBookingEvent(
    booking.customerId.toString(),
    'SERVICE_COMPLETED',
    'Service completed',
    'Your service has been completed.',
    bookingId,
  );

  await processReferralQualifications(bookingId);
  await awardBookingRewardCoins(
    bookingId,
    booking.customerId.toString(),
    booking.price?.finalAmount ?? 0,
  );
  await awardReferrerBookingCoins(bookingId, booking.customerId.toString());

  emitBookingServiceCompleted(booking.customerId.toString(), {
    bookingId,
    status: booking.status,
  });

  scheduleInvoiceGeneration(bookingId);
  void recalculateTrustMetrics(booking.providerId.toString());
  void import('@/modules/trust-protection/guarantee-snapshot.service.js').then((m) =>
    m.captureGuaranteeSnapshot(bookingId),
  );
  void import('@/modules/trust-protection/quality-checklist.service.js').then((m) =>
    m.snapshotChecklistForBooking(bookingId, booking.serviceId.toString()),
  );

  const completion = await ServiceCompletion.findOne({ bookingId });
  return { bookingId, status: booking.status, completion: completion ? serializeCompletion(completion) : null };
}

export async function getCompletionSummary(
  userId: string,
  bookingId: string,
  role: 'CUSTOMER' | 'PROVIDER',
) {
  const filter: Record<string, unknown> = { _id: bookingId };
  if (role === 'CUSTOMER') filter.customerId = userId;
  if (role === 'PROVIDER') filter.providerId = userId;

  const booking = await Booking.findOne(filter);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const completion = await ServiceCompletion.findOne({ bookingId });
  if (!completion) return null;

  return {
    ...serializeCompletion(completion),
    bookingType: booking.bookingType as BookingType,
    paymentStatus: booking.payment.status,
    finalAmount: booking.price.finalAmount,
  };
}

export async function confirmCompletion(customerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new AppError('Booking is not completed yet.', 409, ErrorCode.CONFLICT);
  }

  if (booking.tracking?.completionConfirmedAt) {
    return { confirmedAt: booking.tracking.completionConfirmedAt.toISOString() };
  }

  if (!booking.tracking) booking.tracking = { state: TrackingState.COMPLETED };
  booking.tracking.completionConfirmedAt = new Date();
  booking.tracking.state = TrackingState.COMPLETED;
  await booking.save();

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.CUSTOMER_CONFIRMED_COMPLETION,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
  });

  return { confirmedAt: booking.tracking.completionConfirmedAt!.toISOString() };
}

function serializeCompletion(doc: InstanceType<typeof ServiceCompletion>) {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    summary: doc.summary,
    parts: doc.parts,
    recommendations: doc.recommendations,
    checklist: doc.checklist,
    declaredAt: doc.declaredAt.toISOString(),
  };
}
