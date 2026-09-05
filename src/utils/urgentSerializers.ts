import type { IUrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import type { IUrgentRequest } from '@/models/UrgentRequest.js';
import { env } from '@/config/env.js';

export function serializeUrgentRequestSummary(request: IUrgentRequest) {
  return {
    id: request._id.toString(),
    requestNumber: request.requestNumber,
    customerId: request.customerId.toString(),
    serviceId: request.serviceId.toString(),
    customServiceName: request.customServiceName,
    providerId: request.providerId?.toString(),
    bookingId: request.bookingId?.toString(),
    status: request.status,
    customerNotes: request.customerNotes,
    address: {
      addressLine1: request.addressSnapshot.addressLine1,
      city: request.addressSnapshot.city,
      area: request.addressSnapshot.city,
    },
    pricing: request.pricing,
    paymentMethod: request.paymentMethod,
    searchProgress: {
      currentRadiusKm: request.searchConfig.currentRadiusKm ?? 1,
      notifiedCount: request.searchConfig.notifiedCount ?? request.searchConfig.broadcastCount ?? 0,
      eligiblePoolSize: request.searchConfig.eligiblePoolSize ?? 100,
      waveIndex: request.searchConfig.waveIndex ?? 0,
    },
    expiresAt: request.expiresAt.toISOString(),
    acceptedAt: request.acceptedAt?.toISOString(),
    createdAt: request.createdAt.toISOString(),
  };
}

export function serializeUrgentRequestDetail(
  request: IUrgentRequest,
  options?: {
    serviceName?: string;
    providerName?: string;
    provider?: {
      fullName?: string;
      profileImage?: string;
      experienceYears?: number;
      phone?: string;
    };
    dispatchTargets?: IUrgentDispatchTarget[];
  },
) {
  return {
    ...serializeUrgentRequestSummary(request),
    address: request.addressSnapshot,
    searchConfig: request.searchConfig,
    serviceName: request.customServiceName ?? options?.serviceName,
    providerName: options?.providerName,
    provider: options?.provider,
    dispatchTargets: options?.dispatchTargets?.map((t) => ({
      id: t._id.toString(),
      providerId: t.providerId.toString(),
      status: t.status,
      distanceMeters: t.distanceMeters,
      roadDistanceMeters: t.roadDistanceMeters,
      etaMinutes: t.etaMinutes,
      rankScore: t.rankScore,
      notifiedAt: t.notifiedAt?.toISOString(),
      respondedAt: t.respondedAt?.toISOString(),
    })),
  };
}

function estimateTravelMinutes(distanceMeters?: number): number {
  if (!distanceMeters || distanceMeters <= 0) return 5;
  return Math.max(1, Math.round(distanceMeters / 500));
}

export function serializeProviderUrgentTarget(
  request: IUrgentRequest,
  target: IUrgentDispatchTarget,
  serviceName: string,
) {
  const distanceMeters = target.distanceMeters ?? 0;
  // UI shows road distance/ETA when available (from Google Directions); the
  // aerial distanceMeters remains the authoritative matching metric.
  const roadDistanceMeters = target.roadDistanceMeters ?? distanceMeters;
  return {
    urgentRequestId: request._id.toString(),
    requestNumber: request.requestNumber,
    status: request.status,
    service: { name: serviceName },
    customerArea: request.addressSnapshot.city,
    distanceMeters,
    distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
    roadDistanceMeters,
    roadDistanceKm: Math.round((roadDistanceMeters / 1000) * 10) / 10,
    estimatedTravelMinutes: target.etaMinutes ?? estimateTravelMinutes(roadDistanceMeters),
    estimatedEarnings: request.pricing.providerPayoutAmount ?? request.pricing.estimatedTotal,
    customerNotes: request.customerNotes,
    paymentMethod: request.paymentMethod,
    expiresAt: request.expiresAt.toISOString(),
    invitationExpiresAt: target.notifiedAt
      ? new Date(
          target.notifiedAt.getTime() + env.urgent.invitationTtlSeconds * 1000,
        ).toISOString()
      : undefined,
    notifiedAt: target.notifiedAt?.toISOString(),
    dispatchStatus: target.status,
    pricing: request.pricing,
  };
}
