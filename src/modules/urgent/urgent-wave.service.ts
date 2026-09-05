import {
  UrgentDispatchTargetStatus,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import mongoose from 'mongoose';
import { UrgentDispatchTarget } from '@/models/UrgentDispatchTarget.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { Service } from '@/models/Service.js';
import {
  matchUrgentProviders,
  matchOfflineUrgentProviders,
  countEligibleUrgentPool,
} from '@/modules/urgent/urgent-matching.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { getPushNotificationService } from '@/modules/push/push-notification.service.js';
import { logger } from '@/utils/logger.js';
import {
  emitUrgentExpired,
  emitUrgentNewRequest,
  emitUrgentRequestClosed,
  emitUrgentSearchProgress,
  emitUrgentSearching,
  emitToAdmin,
} from '@/modules/realtime/socket.service.js';
import {
  serializeProviderUrgentTarget,
  serializeUrgentRequestSummary,
} from '@/utils/urgentSerializers.js';
import { estimateRouteEta, routeEtaMinutes } from '@/modules/tracking/route-eta.service.js';
import { getDispatchConfig } from '@/modules/urgent/urgent-config.service.js';

const POOL_CAP = 100;

type DispatchSession = {
  invitationTimer?: NodeJS.Timeout;
  expandTimer?: NodeJS.Timeout;
  radiusKm: number;
  /** Targets from the current batch; when all resolve, we advance. */
  pendingTargetIds: string[];
  /** Guards against the batch timer and the last reject racing to re-ring. */
  advancing?: boolean;
};

const activeSessions = new Map<string, DispatchSession>();

function getSession(requestId: string): DispatchSession {
  let session = activeSessions.get(requestId);
  if (!session) {
    session = { radiusKm: 1, pendingTargetIds: [] };
    activeSessions.set(requestId, session);
  }
  return session;
}

function clearSessionTimers(session: DispatchSession) {
  if (session.invitationTimer) {
    clearTimeout(session.invitationTimer);
    session.invitationTimer = undefined;
  }
  if (session.expandTimer) {
    clearTimeout(session.expandTimer);
    session.expandTimer = undefined;
  }
}

/**
 * Notify a single provider. The push notification is best-effort and NEVER
 * fatal: a provider whose push token is stale or whose app is background /
 * restricted must not break the dispatch of the remaining batch. When the
 * provider has a known location we also compute a road-based ETA for the UI.
 */
async function notifySingleTarget(
  request: InstanceType<typeof UrgentRequest>,
  target: InstanceType<typeof UrgentDispatchTarget>,
  serviceName: string,
) {
  const providerId = target.providerId.toString();

  try {
    const presence = await ProviderPresence.findOne({ providerId }).select('currentLocation');
    if (presence?.currentLocation?.coordinates?.length) {
      const origin = {
        latitude: presence.currentLocation.coordinates[1],
        longitude: presence.currentLocation.coordinates[0],
      };
      const dest = {
        latitude: request.location.coordinates[1],
        longitude: request.location.coordinates[0],
      };
      const route = await estimateRouteEta(origin, dest);
      target.roadDistanceMeters = route.distanceMeters;
      target.etaMinutes = routeEtaMinutes(route, target.distanceMeters);
    }
  } catch {
    // Road ETA is best-effort; fall back to aerial values on the serializer.
  }

  const push = getPushNotificationService();
  const payload = serializeProviderUrgentTarget(request, target, serviceName);
  emitUrgentNewRequest(providerId, payload);

  try {
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
  } catch (error) {
    logger.warn('urgent push notification failed (non-fatal)', {
      providerId,
      urgentRequestId: request._id.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  target.status = UrgentDispatchTargetStatus.NOTIFIED;
  target.notifiedAt = new Date();
  await target.save();
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

async function getExcludedProviderIds(requestId: mongoose.Types.ObjectId): Promise<string[]> {
  const targets = await UrgentDispatchTarget.find({ urgentRequestId: requestId });
  return targets
    .filter((t) =>
      [
        UrgentDispatchTargetStatus.PENDING,
        UrgentDispatchTargetStatus.NOTIFIED,
        UrgentDispatchTargetStatus.VIEWED,
        UrgentDispatchTargetStatus.REJECTED,
        UrgentDispatchTargetStatus.EXPIRED,
        UrgentDispatchTargetStatus.LOST,
        UrgentDispatchTargetStatus.ACCEPTED,
      ].includes(t.status),
    )
    .map((t) => t.providerId.toString());
}

/**
 * Find up to `limit` NEW providers within radiusKm for the next batch.
 * Combines online providers (real-time socket delivery) with offline/background
 * providers (push notification delivery) to maximize match probability.
 */
async function findNextProviders(
  request: InstanceType<typeof UrgentRequest>,
  radiusKm: number,
  excludeProviderIds: string[],
  limit: number,
) {
  const [lng, lat] = request.location.coordinates;
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
    maxBroadcastProviders: limit,
    addressForAreaCheck,
    excludeProviderIds,
  });
  // Offline/background providers receive offers via push notification only —
  // they don't receive live socket events. Combining both delivery channels
  // increases match probability, especially in low-density areas.
  const offlineMatches = await matchOfflineUrgentProviders({
    serviceId: request.serviceId.toString(),
    coordinates: [lng, lat],
    maxDistanceKm: radiusKm,
    maxBroadcastProviders: limit,
    addressForAreaCheck,
    excludeProviderIds,
  });
  return [...onlineMatches, ...offlineMatches].slice(0, limit);
}

async function expireNoProviders(request: InstanceType<typeof UrgentRequest>) {
  request.status = UrgentRequestStatus.EXPIRED;
  request.expiresAt = new Date();
  await request.save();
  logger.info('urgent dispatch failed: no providers', {
    urgentRequestId: request._id.toString(),
    maxRadiusKm: request.searchConfig.currentRadiusKm,
    notifiedCount: request.searchConfig.notifiedCount,
  });
  emitUrgentExpired(request.customerId.toString(), serializeUrgentRequestSummary(request));
  await createNotification({
    userId: request.customerId.toString(),
    type: 'URGENT_NO_PROVIDER',
    title: 'No professionals available',
    body: 'No nearby professionals are available right now.',
    data: { urgentRequestId: request._id.toString() },
  });
  stopUrgentSearchWaves(request._id.toString());
}

async function runRingNextProvider(requestId: string) {
  const request = await UrgentRequest.findById(requestId);
  if (!request || request.status !== UrgentRequestStatus.SEARCHING) {
    stopUrgentSearchWaves(requestId);
    return;
  }
  if (request.expiresAt <= new Date()) {
    stopUrgentSearchWaves(requestId);
    return;
  }

  const session = getSession(requestId);
  clearSessionTimers(session);
  session.pendingTargetIds = [];

  const config = await getDispatchConfig();
  const maxDistanceKm = Math.min(request.searchConfig.maxDistanceKm, config.maxRadiusKm);
  const batchSize = Math.min(config.batchSize, 10);
  const ttlMs = config.invitationTtlSeconds * 1000;
  let radiusKm = session.radiusKm;

  const [lng, lat] = request.location.coordinates;
  const addressForAreaCheck = {
    postalCode: request.addressSnapshot.postalCode,
    city: request.addressSnapshot.city,
    location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
    customerId: request.customerId,
  };

  if (request.searchConfig.eligiblePoolSize === 0) {
    const poolSize = await countEligibleUrgentPool({
      serviceId: request.serviceId.toString(),
      coordinates: [lng, lat],
      maxDistanceKm,
      addressForAreaCheck,
    });
    request.searchConfig.eligiblePoolSize = Math.min(poolSize, POOL_CAP);
    logger.info('urgent dispatch session started', {
      urgentRequestId: requestId,
      eligiblePoolSize: request.searchConfig.eligiblePoolSize,
      maxDistanceKm,
    });
  }

  const excludeProviderIds = await getExcludedProviderIds(request._id);
  let matches = await findNextProviders(request, radiusKm, excludeProviderIds, batchSize);

  while (!matches.length && radiusKm < maxDistanceKm) {
    radiusKm += 1;
    session.radiusKm = radiusKm;
    matches = await findNextProviders(request, radiusKm, excludeProviderIds, batchSize);
  }

  session.radiusKm = radiusKm;
  request.searchConfig.currentRadiusKm = radiusKm;
  request.searchConfig.waveIndex = radiusKm;
  await request.save();
  emitProgress(request);

  if (!matches.length) {
    // No new providers at this radius. If nothing is still pending anywhere in
    // the request, the search has truly exhausted — notify the customer.
    const stillPending = await UrgentDispatchTarget.countDocuments({
      urgentRequestId: requestId,
      status: {
        $in: [
          UrgentDispatchTargetStatus.PENDING,
          UrgentDispatchTargetStatus.NOTIFIED,
          UrgentDispatchTargetStatus.VIEWED,
        ],
      },
    });
    if (stillPending === 0) {
      await expireNoProviders(request);
    }
    return;
  }

  const targets = await UrgentDispatchTarget.insertMany(
    matches.map((m) => ({
      urgentRequestId: request._id,
      providerId: new mongoose.Types.ObjectId(m.providerId),
      status: UrgentDispatchTargetStatus.PENDING,
      distanceMeters: m.distanceMeters,
      rankScore: m.rankScore,
    })),
  );

  session.pendingTargetIds = targets.map((t) => t._id.toString());

  const notifiedCount = excludeProviderIds.length + targets.length;
  request.searchConfig.notifiedCount = notifiedCount;
  request.searchConfig.broadcastCount = notifiedCount;
  await request.save();
  emitProgress(request);

  const service = await Service.findById(request.serviceId).select('name');
  const serviceName = request.customServiceName ?? service?.name ?? 'Urgent service';

  // Notify the whole batch in parallel; each notification is independent.
  await Promise.all(targets.map((t) => notifySingleTarget(request, t, serviceName)));
  logger.info('urgent batch offers created', {
    urgentRequestId: requestId,
    count: targets.length,
    providerIds: targets.map((t) => t.providerId.toString()),
    radiusKm,
    attempt: request.searchConfig.broadcastCount,
  });

  session.invitationTimer = setTimeout(() => {
    void handleBatchTimeout(requestId, session.pendingTargetIds);
  }, ttlMs);
}

/**
 * Batch invitation expiry. Expires every still-pending target in the batch, then
 * advances to the next batch. Runs in `finally` so a next ring always follows.
 */
async function handleBatchTimeout(requestId: string, targetIds: string[]) {
  try {
    const request = await UrgentRequest.findById(requestId);
    if (!request || request.status !== UrgentRequestStatus.SEARCHING) {
      stopUrgentSearchWaves(requestId);
      return;
    }

    const targets = await UrgentDispatchTarget.find({ _id: { $in: targetIds } });
    for (const target of targets) {
      if (
        [
          UrgentDispatchTargetStatus.NOTIFIED,
          UrgentDispatchTargetStatus.VIEWED,
          UrgentDispatchTargetStatus.PENDING,
        ].includes(target.status)
      ) {
        target.status = UrgentDispatchTargetStatus.EXPIRED;
        target.respondedAt = new Date();
        await target.save();
        emitUrgentRequestClosed(target.providerId.toString(), {
          urgentRequestId: requestId,
          reason: 'invitation-expired',
        });
      }
    }
  } catch (error) {
    logger.error('urgent batch invitation timeout failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    void advanceToNextBatch(requestId);
  }
}

/**
 * Advance to the next dispatch batch ONLY when every pending offer has resolved.
 * The `advancing` flag prevents the batch timer and the last reject from both
 * re-ringing (a classic race when a batch resolves at the same instant).
 */
async function advanceToNextBatch(requestId: string) {
  try {
    const session = activeSessions.get(requestId);
    if (!session || session.advancing) return;
    session.advancing = true;

    try {
      const stillPending = await UrgentDispatchTarget.countDocuments({
        urgentRequestId: requestId,
        status: {
          $in: [
            UrgentDispatchTargetStatus.PENDING,
            UrgentDispatchTargetStatus.NOTIFIED,
            UrgentDispatchTargetStatus.VIEWED,
          ],
        },
      });
      if (stillPending > 0) return;

      clearSessionTimers(session);
      session.pendingTargetIds = [];
      await runRingNextProvider(requestId);
    } finally {
      session.advancing = false;
    }
  } catch (error) {
    logger.error('urgent advance to next batch failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    stopUrgentSearchWaves(requestId);
  }
}

/**
 * Fire-and-forget dispatch step. Runs in the background, so it must never leak
 * unhandled rejections (e.g. the request disappearing or being cancelled mid-dispatch).
 */
async function ringNextProvider(requestId: string) {
  try {
    await runRingNextProvider(requestId);
  } catch (error) {
    logger.error('urgent dispatch ring failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    stopUrgentSearchWaves(requestId);
  }
}

/** Called when a provider declines — advance only once the whole batch is resolved. */
export async function continueUrgentSearchAfterReject(requestId: string) {
  const request = await UrgentRequest.findById(requestId);
  if (!request || request.status !== UrgentRequestStatus.SEARCHING) return;
  void advanceToNextBatch(requestId);
}

export async function startUrgentSearchWaves(requestId: string) {
  stopUrgentSearchWaves(requestId);
  const request = await UrgentRequest.findById(requestId);
  if (!request) return;

  request.searchConfig.currentRadiusKm = 1;
  request.searchConfig.notifiedCount = 0;
  request.searchConfig.waveIndex = 0;
  request.searchConfig.eligiblePoolSize = 0;
  request.searchConfig.broadcastCount = 0;
  await request.save();

  activeSessions.set(requestId, { radiusKm: 1, pendingTargetIds: [] });

  emitUrgentSearching(request.customerId.toString(), serializeUrgentRequestSummary(request));
  emitToAdmin('urgent:updated', { id: request._id.toString(), status: request.status });

  void ringNextProvider(requestId);
}

export function stopUrgentSearchWaves(requestId: string) {
  const session = activeSessions.get(requestId);
  if (session) {
    clearSessionTimers(session);
    activeSessions.delete(requestId);
  }
}
