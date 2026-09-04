import type { IUrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import type { IUrgentRequest } from '@/models/UrgentRequest.js';

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
      rankScore: t.rankScore,
      notifiedAt: t.notifiedAt?.toISOString(),
      respondedAt: t.respondedAt?.toISOString(),
    })),
  };
}

export function serializeProviderUrgentTarget(
  request: IUrgentRequest,
  target: IUrgentDispatchTarget,
  serviceName: string,
) {
  return {
    urgentRequestId: request._id.toString(),
    requestNumber: request.requestNumber,
    status: request.status,
    service: { name: serviceName },
    customerArea: request.addressSnapshot.city,
    distanceMeters: target.distanceMeters,
    estimatedEarnings: request.pricing.providerPayoutAmount ?? request.pricing.estimatedTotal,
    customerNotes: request.customerNotes,
    expiresAt: request.expiresAt.toISOString(),
    dispatchStatus: target.status,
    pricing: request.pricing,
  };
}
