import { UrgentDispatchTargetStatus, UrgentRequestStatus } from '@ghaarfix/shared-types';
import { Types } from 'mongoose';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import type { IUrgentRequest } from '@/models/UrgentRequest.js';
import { env } from '@/config/env.js';
import { startUrgentSearchWaves } from '@/modules/urgent/urgent-wave.service.js';
import { emitUrgentSearching } from '@/modules/realtime/socket.service.js';
import { serializeUrgentRequestSummary } from '@/utils/urgentSerializers.js';

type ResetUrgentRedispatchInput = {
  request: IUrgentRequest;
  rejectedProviderId: string;
  customerId: string;
  expiresAt?: Date;
  resetEligiblePool?: boolean;
};

export async function markUrgentProviderRejected(
  urgentRequestId: Types.ObjectId | string,
  providerId: string,
) {
  await UrgentDispatchTarget.updateOne(
    { urgentRequestId, providerId },
    { status: UrgentDispatchTargetStatus.REJECTED, respondedAt: new Date() },
  );
}

export async function resetUrgentRequestForRedispatch(input: ResetUrgentRedispatchInput) {
  const { request, rejectedProviderId, customerId } = input;

  await markUrgentProviderRejected(request._id, rejectedProviderId);

  request.status = UrgentRequestStatus.SEARCHING;
  request.providerId = undefined;
  request.acceptedAt = undefined;
  request.bookingId = undefined;
  request.completedAt = undefined;
  request.expiresAt =
    input.expiresAt ?? new Date(Date.now() + env.urgent.requestTimeoutSeconds * 1000);
  request.searchConfig.currentRadiusKm = 1;
  request.searchConfig.notifiedCount = 0;
  request.searchConfig.waveIndex = 0;
  if (input.resetEligiblePool !== false) {
    request.searchConfig.eligiblePoolSize = 0;
  }
  await request.save();

  await startUrgentSearchWaves(request._id.toString());
  emitUrgentSearching(customerId, serializeUrgentRequestSummary(request));

  return request;
}
