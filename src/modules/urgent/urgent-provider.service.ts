import mongoose from 'mongoose';
import {
  BLOCKING_BOOKING_STATUSES,
  ErrorCode,
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import { Service } from '@/models/Service.js';
import { UrgentAcceptIdempotency } from '@/models/UrgentAcceptIdempotency.js';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import {
  emitUrgentAcceptedByOther,
  emitUrgentProviderFound,
  emitUrgentRequestClosed,
  emitToAdmin,
} from '@/modules/realtime/socket.service.js';
import { convertUrgentToBooking } from '@/modules/urgent/urgent.service.js';
import { continueUrgentSearchAfterReject, stopUrgentSearchWaves } from '@/modules/urgent/urgent-wave.service.js';
import { setProviderBusy } from '@/modules/presence/presence.service.js';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { logger } from '@/utils/logger.js';
import { AppError } from '@/utils/AppError.js';
import {
  serializeProviderUrgentTarget,
  serializeUrgentRequestSummary,
} from '@/utils/urgentSerializers.js';
import { serializeBookingSummary } from '@/utils/bookingSerializers.js';

async function getDispatchTarget(providerId: string, urgentRequestId: string) {
  const target = await UrgentDispatchTarget.findOne({ urgentRequestId, providerId });
  if (!target) {
    throw new AppError('You are not eligible for this urgent request.', 403, ErrorCode.FORBIDDEN);
  }
  return target;
}

export async function listProviderUrgentRequests(providerId: string) {
  const targets = await UrgentDispatchTarget.find({
    providerId,
    status: { $in: [UrgentDispatchTargetStatus.PENDING, UrgentDispatchTargetStatus.NOTIFIED, UrgentDispatchTargetStatus.VIEWED] },
  }).sort({ createdAt: -1 });

  const requestIds = targets.map((t) => t.urgentRequestId);
  const requests = await UrgentRequest.find({
    _id: { $in: requestIds },
    status: UrgentRequestStatus.SEARCHING,
    expiresAt: { $gt: new Date() },
  });
  const requestMap = new Map(requests.map((r) => [r._id.toString(), r]));
  const serviceIds = [...new Set(requests.map((r) => r.serviceId.toString()))];
  const services = await Service.find({ _id: { $in: serviceIds } }).select('name');
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s.name]));

  return targets
    .map((target) => {
      const request = requestMap.get(target.urgentRequestId.toString());
      if (!request) return null;
      return serializeProviderUrgentTarget(
        request,
        target,
        serviceMap.get(request.serviceId.toString()) ?? 'Service',
      );
    })
    .filter(Boolean);
}

export async function getProviderUrgentRequest(providerId: string, urgentRequestId: string) {
  const target = await getDispatchTarget(providerId, urgentRequestId);
  const request = await UrgentRequest.findById(urgentRequestId);
  if (!request || request.status !== UrgentRequestStatus.SEARCHING) {
    throw new AppError('Urgent request is no longer available.', 404, ErrorCode.NOT_FOUND);
  }
  if (request.expiresAt <= new Date()) {
    throw new AppError('This urgent request has expired.', 409, ErrorCode.CONFLICT);
  }
  if (target.status === UrgentDispatchTargetStatus.PENDING || target.status === UrgentDispatchTargetStatus.NOTIFIED) {
    target.status = UrgentDispatchTargetStatus.VIEWED;
    target.seenAt = new Date();
    await target.save();
  }
  const service = await Service.findById(request.serviceId).select('name');
  return serializeProviderUrgentTarget(request, target, service?.name ?? 'Service');
}

export async function acceptUrgentRequest(providerId: string, urgentRequestId: string) {
  const request = await UrgentRequest.findById(urgentRequestId);
  if (!request || request.status !== UrgentRequestStatus.SEARCHING) {
    throw new AppError('This urgent request is no longer available.', 409, ErrorCode.CONFLICT);
  }

  const existingAccept = await UrgentAcceptIdempotency.findOne({ providerId, urgentRequestId });
  if (existingAccept?.bookingId) {
    const request = await UrgentRequest.findById(urgentRequestId);
    const booking = await import('@/models/Booking.js').then((m) =>
      m.Booking.findById(existingAccept.bookingId),
    );
    return {
      urgentRequest: request ? serializeUrgentRequestSummary(request) : null,
      booking: booking ? serializeBookingSummary(booking, 'provider') : null,
    };
  }

  const target = await UrgentDispatchTarget.findOne({
    urgentRequestId,
    providerId,
    status: { $nin: [UrgentDispatchTargetStatus.REJECTED, UrgentDispatchTargetStatus.LOST, UrgentDispatchTargetStatus.EXPIRED] },
  });
  if (!target) {
    throw new AppError('You are not eligible for this urgent request.', 403, ErrorCode.FORBIDDEN);
  }

  // Double-booking protection (backend-authoritative): the provider may have taken
  // another job after this offer was created. Re-validate right before the claim.
  const activeJobCount = await Booking.countDocuments({
    providerId,
    status: { $in: BLOCKING_BOOKING_STATUSES },
  });
  if (activeJobCount >= env.urgent.maxActiveJobsPerProvider) {
    target.status = UrgentDispatchTargetStatus.REJECTED;
    target.respondedAt = new Date();
    await target.save();
    logger.info('urgent offer rejected: provider busy', {
      urgentRequestId,
      providerId,
      activeJobCount,
    });
    void continueUrgentSearchAfterReject(urgentRequestId);
    throw new AppError('You already have an active job.', 409, ErrorCode.CONFLICT);
  }

  const claimed = await UrgentRequest.findOneAndUpdate(
    {
      _id: urgentRequestId,
      status: UrgentRequestStatus.SEARCHING,
      providerId: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: UrgentRequestStatus.ASSIGNED,
        providerId: new mongoose.Types.ObjectId(providerId),
        acceptedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!claimed) {
    const current = await UrgentRequest.findById(urgentRequestId);
    if (current?.providerId?.toString() === providerId && current.bookingId) {
      const booking = await import('@/models/Booking.js').then((m) =>
        m.Booking.findById(current.bookingId),
      );
      return {
        urgentRequest: serializeUrgentRequestSummary(current),
        booking: booking ? serializeBookingSummary(booking, 'provider') : null,
      };
    }
    emitUrgentAcceptedByOther(providerId, { urgentRequestId });
    throw new AppError('Another professional has already accepted this request.', 409, ErrorCode.CONFLICT);
  }

  target.status = UrgentDispatchTargetStatus.ACCEPTED;
  target.respondedAt = new Date();
  await target.save();
  logger.info('urgent offer accepted', {
    urgentRequestId,
    providerId,
    bookingId: claimed._id.toString(),
  });

  await UrgentDispatchTarget.updateMany(
    {
      urgentRequestId: claimed._id,
      providerId: { $ne: providerId },
      status: { $nin: [UrgentDispatchTargetStatus.REJECTED] },
    },
    { status: UrgentDispatchTargetStatus.LOST, respondedAt: new Date() },
  );

  const booking = await convertUrgentToBooking(claimed, providerId);

  stopUrgentSearchWaves(urgentRequestId);

  await UrgentAcceptIdempotency.findOneAndUpdate(
    { providerId, urgentRequestId },
    { bookingId: booking._id },
    { upsert: true },
  );

  await setProviderBusy(providerId);

  const lostTargets = await UrgentDispatchTarget.find({
    urgentRequestId: claimed._id,
    status: UrgentDispatchTargetStatus.LOST,
  });
  for (const lost of lostTargets) {
    emitUrgentRequestClosed(lost.providerId.toString(), {
      urgentRequestId: claimed._id.toString(),
      reason: 'accepted-by-other',
    });
  }

  const profile = await import('@/models/ProviderProfile.js').then((m) =>
    m.ProviderProfile.findOne({ userId: providerId }).select('fullName profileImage experienceYears'),
  );

  emitUrgentProviderFound(claimed.customerId.toString(), {
    urgentRequest: serializeUrgentRequestSummary(claimed),
    provider: {
      fullName: profile?.fullName,
      profileImage: profile?.profileImage,
      experienceYears: profile?.experienceYears,
    },
    booking: serializeBookingSummary(booking, 'provider'),
  });

  await createNotification({
    userId: claimed.customerId.toString(),
    type: 'URGENT_PROVIDER_FOUND',
    title: 'Professional found!',
    body: `${profile?.fullName ?? 'A professional'} accepted your urgent request.`,
    data: { urgentRequestId: claimed._id.toString(), bookingId: booking._id.toString() },
  });

  emitToAdmin('urgent:updated', { id: claimed._id.toString(), status: claimed.status });

  return {
    urgentRequest: serializeUrgentRequestSummary(claimed),
    booking: serializeBookingSummary(booking, 'provider'),
  };
}

export async function rejectUrgentRequest(
  providerId: string,
  urgentRequestId: string,
  reason?: string,
) {
  const target = await getDispatchTarget(providerId, urgentRequestId);
  if (target.status === UrgentDispatchTargetStatus.REJECTED) {
    return { success: true };
  }
  target.status = UrgentDispatchTargetStatus.REJECTED;
  target.respondedAt = new Date();
  await target.save();

  await continueUrgentSearchAfterReject(urgentRequestId);
  return { success: true, reason };
}
