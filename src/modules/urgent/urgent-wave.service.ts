import {
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import mongoose from 'mongoose';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { Service } from '@/models/Service.js';
import { matchUrgentProviders, matchOfflineUrgentProviders, countEligibleUrgentPool } from '@/modules/urgent/urgent-matching.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { getPushNotificationService } from '@/modules/push/push-notification.service.js';
import {
  emitUrgentExpired,
  emitUrgentNewRequest,
  emitUrgentSearchProgress,
  emitUrgentSearching,
  emitToAdmin,
} from '@/modules/realtime/socket.service.js';
import {
  serializeProviderUrgentTarget,
  serializeUrgentRequestSummary,
} from '@/utils/urgentSerializers.js';

const WAVE_INTERVAL_MS = 8_000;
const PROVIDERS_PER_WAVE = 5;
const POOL_CAP = 100;

const activeWaveTimers = new Map<string, NodeJS.Timeout>();

async function broadcastTargets(
  request: InstanceType<typeof UrgentRequest>,
  targets: InstanceType<typeof UrgentDispatchTarget>[],
  serviceName: string,
) {
  const push = getPushNotificationService();
  for (const target of targets) {
    const providerId = target.providerId.toString();
    const payload = serializeProviderUrgentTarget(request, target, serviceName);
    emitUrgentNewRequest(providerId, payload);
    await push.sendToProvider(providerId, {
      title: '🚨 EMERGENCY JOB ALERT',
      subtitle: serviceName,
      body: `Urgent ${serviceName} needed near you. Tap to accept now.`,
      data: {
        type: 'URGENT_REQUEST',
        urgentRequestId: request._id.toString(),
        route: `/urgent/${request._id.toString()}`,
        tier: 'emergency',
      },
      collapseId: `urgent-${request._id.toString()}`,
      tier: 'emergency',
    });
    target.status = UrgentDispatchTargetStatus.NOTIFIED;
    target.notifiedAt = new Date();
    await target.save();
  }
}

function emitProgress(request: InstanceType<typeof UrgentRequest>) {
  const payload = {
    urgentRequestId: request._id.toString(),
    searchProgress: {
      currentRadiusKm: request.searchConfig.currentRadiusKm ?? 1,
      notifiedCount: request.searchConfig.notifiedCount ?? 0,
      eligiblePoolSize: request.searchConfig.eligiblePoolSize ?? POOL_CAP,
      waveIndex: request.searchConfig.waveIndex ?? 1,
    },
  };
  emitUrgentSearchProgress(request.customerId.toString(), payload);
}

async function runWave(requestId: string, waveIndex: number) {
  const request = await UrgentRequest.findById(requestId);
  if (!request || request.status !== UrgentRequestStatus.SEARCHING) {
    activeWaveTimers.delete(requestId);
    return;
  }
  if (request.expiresAt <= new Date()) {
    activeWaveTimers.delete(requestId);
    return;
  }

  const maxDistanceKm = Math.min(request.searchConfig.maxDistanceKm, 10);
  const radiusKm = Math.min(waveIndex, maxDistanceKm);
  const [lng, lat] = request.location.coordinates;

  const existingTargets = await UrgentDispatchTarget.find({ urgentRequestId: request._id });
  const excludeProviderIds = existingTargets.map((t) => t.providerId.toString());

  const addressForAreaCheck = {
    postalCode: request.addressSnapshot.postalCode,
    city: request.addressSnapshot.city,
    location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
    customerId: request.customerId,
  };

  const onlineMatches = await matchUrgentProviders({
    serviceId: request.serviceId.toString(),
    coordinates: [lng, lat],
    maxDistanceKm: radiusKm,
    maxBroadcastProviders: PROVIDERS_PER_WAVE,
    addressForAreaCheck,
    excludeProviderIds,
  });

  const offlineMatches = await matchOfflineUrgentProviders({
    serviceId: request.serviceId.toString(),
    coordinates: [lng, lat],
    maxDistanceKm: radiusKm,
    maxBroadcastProviders: Math.max(2, Math.ceil(PROVIDERS_PER_WAVE / 2)),
    addressForAreaCheck,
    excludeProviderIds: [...excludeProviderIds, ...onlineMatches.map((m) => m.providerId)],
  });

  const matches = [...onlineMatches, ...offlineMatches];

  if (waveIndex === 1 && request.searchConfig.eligiblePoolSize === 0) {
    const poolSize = await countEligibleUrgentPool({
      serviceId: request.serviceId.toString(),
      coordinates: [lng, lat],
      maxDistanceKm,
      addressForAreaCheck,
    });
    request.searchConfig.eligiblePoolSize = Math.min(poolSize, POOL_CAP);
  }

  let newTargets: InstanceType<typeof UrgentDispatchTarget>[] = [];
  if (matches.length > 0) {
    newTargets = await UrgentDispatchTarget.insertMany(
      matches.map((m) => ({
        urgentRequestId: request._id,
        providerId: new mongoose.Types.ObjectId(m.providerId),
        status: UrgentDispatchTargetStatus.PENDING,
        distanceMeters: m.distanceMeters,
        rankScore: m.rankScore,
      })),
    );
  }

  const notifiedCount = excludeProviderIds.length + newTargets.length;
  request.searchConfig.currentRadiusKm = radiusKm;
  request.searchConfig.notifiedCount = notifiedCount;
  request.searchConfig.broadcastCount = notifiedCount;
  request.searchConfig.waveIndex = waveIndex;
  await request.save();

  const service = await Service.findById(request.serviceId).select('name');
  const serviceName = request.customServiceName ?? service?.name ?? 'Urgent service';

  if (newTargets.length > 0) {
    await broadcastTargets(request, newTargets, serviceName);
  }

  emitProgress(request);

  if (radiusKm >= maxDistanceKm && notifiedCount === 0) {
    request.status = UrgentRequestStatus.EXPIRED;
    request.expiresAt = new Date();
    await request.save();
    emitUrgentExpired(request.customerId.toString(), serializeUrgentRequestSummary(request));
    await createNotification({
      userId: request.customerId.toString(),
      type: 'URGENT_NO_PROVIDER',
      title: 'No professionals available',
      body: 'No nearby professionals are available right now.',
      data: { urgentRequestId: request._id.toString() },
    });
    activeWaveTimers.delete(requestId);
    return;
  }

  if (radiusKm < maxDistanceKm) {
    const timer = setTimeout(() => {
      void runWave(requestId, waveIndex + 1);
    }, WAVE_INTERVAL_MS);
    activeWaveTimers.set(requestId, timer);
  }
}

export async function startUrgentSearchWaves(requestId: string) {
  const existing = activeWaveTimers.get(requestId);
  if (existing) clearTimeout(existing);
  const request = await UrgentRequest.findById(requestId);
  if (!request) return;

  request.searchConfig.currentRadiusKm = 1;
  request.searchConfig.notifiedCount = 0;
  request.searchConfig.waveIndex = 0;
  request.searchConfig.eligiblePoolSize = 0;
  await request.save();

  emitUrgentSearching(request.customerId.toString(), serializeUrgentRequestSummary(request));
  emitToAdmin('urgent:updated', { id: request._id.toString(), status: request.status });

  void runWave(requestId, 1);
}

export function stopUrgentSearchWaves(requestId: string) {
  const timer = activeWaveTimers.get(requestId);
  if (timer) {
    clearTimeout(timer);
    activeWaveTimers.delete(requestId);
  }
}
