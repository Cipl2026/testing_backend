import {
  BLOCKING_BOOKING_STATUSES,
  ProviderPresenceStatus,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { User } from '@/models/User.js';
import { getTimeOffInRange } from '@/modules/provider-availability/time-off.service.js';
import { providerMatchesAddress } from '@/modules/provider-availability/service-area.service.js';
import {
  getProviderCapacityStatus,
  isCapacityBlocking,
} from '@/modules/operations/provider-capacity.service.js';
import { env } from '@/config/env.js';
import type { ICustomerAddress } from '@/models/CustomerAddress.js';

export interface MatchedProvider {
  providerId: string;
  distanceMeters: number;
  rankScore: number;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function isProviderBusy(providerId: string): Promise<boolean> {
  const [bookingCount, urgentCount] = await Promise.all([
    Booking.countDocuments({
      providerId,
      status: { $in: BLOCKING_BOOKING_STATUSES },
    }),
    UrgentRequest.countDocuments({
      providerId,
      status: UrgentRequestStatus.ASSIGNED,
    }),
  ]);
  return bookingCount + urgentCount >= env.urgent.maxActiveJobsPerProvider;
}

/**
 * Urgent provider matching algorithm (Phase 6):
 * 1. Geospatial filter on ProviderPresence within maxDistanceKm
 * 2. Online + urgentAvailable + fresh lastSeenAt + fresh location
 * 3. ACTIVE provider profile + approved ProviderService with urgent flags
 * 4. Not on time off, not busy, serves customer area
 * 5. Rank: distance (70%) + activeJobCount (30%)
 * 6. Return top maxBroadcastProviders
 */
/**
 * Progressive geo search: start at 25% of max radius, expand until candidates found or max reached.
 */
async function findNearbyPresences(
  coordinates: [number, number],
  maxDistanceMeters: number,
  stalePresenceCutoff: Date,
  staleLocationCutoff: Date,
  minResults = 5,
) {
  const [lng, lat] = coordinates;
  const radiusSteps = [0.25, 0.5, 0.75, 1.0];
  for (const step of radiusSteps) {
    const stepMeters = maxDistanceMeters * step;
    const presences = await ProviderPresence.find({
      isOnline: true,
      urgentAvailable: true,
      status: ProviderPresenceStatus.ONLINE,
      lastSeenAt: { $gte: stalePresenceCutoff },
      locationUpdatedAt: { $gte: staleLocationCutoff },
      currentLocation: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: stepMeters,
        },
      },
    }).limit(100);
    if (presences.length >= minResults || step === 1.0) {
      return presences;
    }
  }
  return [];
}

export async function matchUrgentProviders(input: {
  serviceId: string;
  coordinates: [number, number];
  maxDistanceKm: number;
  maxBroadcastProviders: number;
  addressForAreaCheck: Pick<
    ICustomerAddress,
    'postalCode' | 'city' | 'location' | 'customerId'
  >;
  excludeProviderIds?: string[];
}): Promise<MatchedProvider[]> {
  const [lng, lat] = input.coordinates;
  const maxDistanceMeters = input.maxDistanceKm * 1000;
  const stalePresenceCutoff = new Date(
    Date.now() - env.urgent.presenceTimeoutMinutes * 60 * 1000,
  );
  const staleLocationCutoff = new Date(
    Date.now() - env.urgent.maxProviderLocationAgeMinutes * 60 * 1000,
  );
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const presences = await findNearbyPresences(
    input.coordinates,
    maxDistanceMeters,
    stalePresenceCutoff,
    staleLocationCutoff,
    1,
  );

  if (!presences.length) return [];

  const exclude = new Set(input.excludeProviderIds ?? []);
  const providerIds = presences
    .map((p) => p.providerId.toString())
    .filter((id) => !exclude.has(id));

  const [users, profiles, providerServices] = await Promise.all([
    User.find({ _id: { $in: providerIds }, status: 'ACTIVE' }).select('_id'),
    ProviderProfile.find({
      userId: { $in: providerIds },
      providerStatus: ProviderStatus.ACTIVE,
    }).select('userId'),
    ProviderService.find({
      providerId: { $in: providerIds },
      serviceId: input.serviceId,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
      supportsUrgent: true,
      isUrgentEnabled: true,
    }).select('providerId'),
  ]);

  const activeUserIds = new Set(users.map((u) => u._id.toString()));
  const activeProfileIds = new Set(profiles.map((p) => p.userId.toString()));
  const eligibleServiceIds = new Set(providerServices.map((ps) => ps.providerId.toString()));

  const candidates: MatchedProvider[] = [];

  for (const presence of presences) {
    const providerId = presence.providerId.toString();
    if (!activeUserIds.has(providerId)) continue;
    if (!activeProfileIds.has(providerId)) continue;
    if (!eligibleServiceIds.has(providerId)) continue;
    if (!presence.currentLocation?.coordinates) continue;

    const [pLng, pLat] = presence.currentLocation.coordinates;
    const distanceMeters = haversineMeters(lat, lng, pLat, pLng);
    if (distanceMeters > maxDistanceMeters) continue;

    if (await isProviderBusy(providerId)) continue;

    const timeOff = await getTimeOffInRange(providerId, now, rangeEnd);
    if (timeOff.length > 0) continue;

    const inArea = await providerMatchesAddress(providerId, input.addressForAreaCheck as ICustomerAddress);
    if (!inArea) continue;

    const capacityStatus = await getProviderCapacityStatus(providerId);
    if (isCapacityBlocking(capacityStatus)) continue;

    const distanceScore = 1 - Math.min(distanceMeters / maxDistanceMeters, 1);
    const workloadScore = 1 / (1 + presence.activeJobCount);
    const rankScore = distanceScore * 0.7 + workloadScore * 0.3;

    candidates.push({ providerId, distanceMeters, rankScore });
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore);

  const eligible = candidates.slice(0, input.maxBroadcastProviders * 2);

  try {
    const { evaluateFlag } = await import('@/modules/discovery-growth/feature-flag.service.js');
    const { rankEligibleProviders, applySmartRankingToUrgent } = await import(
      '@/modules/intelligence/provider-matching/smart-matching.service.js'
    );
    const { FeatureFlagKey } = await import('@ghaarfix/shared-types');
    const smartEnabled = await evaluateFlag(FeatureFlagKey.ENABLE_SMART_MATCHING);
    if (smartEnabled && eligible.length > 1) {
      const ranked = await rankEligibleProviders({
        serviceId: input.serviceId,
        candidates: eligible.map((c) => ({
          providerId: c.providerId,
          distanceMeters: c.distanceMeters,
          baseRankScore: c.rankScore,
        })),
        urgentRequestId: undefined,
      });
      const reordered = applySmartRankingToUrgent(eligible, ranked);
      return reordered.slice(0, input.maxBroadcastProviders);
    }
  } catch {
    // Fall back to default ranking
  }

  return eligible.slice(0, input.maxBroadcastProviders);
}

/**
 * Offline / background providers: no live GPS required, but must have a push token,
 * serve the customer area, and offer urgent for the requested service.
 */
export async function matchOfflineUrgentProviders(input: {
  serviceId: string;
  coordinates: [number, number];
  maxDistanceKm: number;
  maxBroadcastProviders: number;
  addressForAreaCheck: Pick<
    ICustomerAddress,
    'postalCode' | 'city' | 'location' | 'customerId'
  >;
  excludeProviderIds?: string[];
}): Promise<MatchedProvider[]> {
  const [lng, lat] = input.coordinates;
  const maxDistanceMeters = input.maxDistanceKm * 1000;
  const exclude = new Set(input.excludeProviderIds ?? []);
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const providerServices = await ProviderService.find({
    serviceId: input.serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
    supportsUrgent: true,
    isUrgentEnabled: true,
  }).select('providerId');

  const providerIds = [
    ...new Set(providerServices.map((ps) => ps.providerId.toString())),
  ].filter((id) => !exclude.has(id));

  if (!providerIds.length) return [];

  const { PushToken } = await import('@/models/PushToken.js');
  const { ProviderServiceArea } = await import('@/models/ProviderServiceArea.js');

  const [users, profiles, pushProviderIds, presences] = await Promise.all([
    User.find({ _id: { $in: providerIds }, status: 'ACTIVE' }).select('_id'),
    ProviderProfile.find({
      userId: { $in: providerIds },
      providerStatus: ProviderStatus.ACTIVE,
    }).select('userId'),
    PushToken.find({ providerId: { $in: providerIds }, isActive: true }).distinct('providerId'),
    ProviderPresence.find({ providerId: { $in: providerIds } }).select(
      'providerId isOnline urgentAvailable status',
    ),
  ]);

  const activeUserIds = new Set(users.map((u) => u._id.toString()));
  const activeProfileIds = new Set(profiles.map((p) => p.userId.toString()));
  const withPush = new Set(pushProviderIds.map((id) => id.toString()));
  const onlineNow = new Set(
    presences
      .filter(
        (p) =>
          p.isOnline &&
          p.urgentAvailable &&
          p.status === ProviderPresenceStatus.ONLINE,
      )
      .map((p) => p.providerId.toString()),
  );

  const candidates: MatchedProvider[] = [];

  for (const providerId of providerIds) {
    if (!activeUserIds.has(providerId)) continue;
    if (!activeProfileIds.has(providerId)) continue;
    if (!withPush.has(providerId)) continue;
    if (onlineNow.has(providerId)) continue;

    if (await isProviderBusy(providerId)) continue;

    const timeOff = await getTimeOffInRange(providerId, now, rangeEnd);
    if (timeOff.length > 0) continue;

    const inArea = await providerMatchesAddress(
      providerId,
      input.addressForAreaCheck as ICustomerAddress,
    );
    if (!inArea) continue;

    const capacityStatus = await getProviderCapacityStatus(providerId);
    if (isCapacityBlocking(capacityStatus)) continue;

    const areas = await ProviderServiceArea.find({ providerId, isActive: true }).select('center');
    if (!areas.length) continue;

    let bestDistance = Infinity;
    for (const area of areas) {
      const distanceMeters = haversineMeters(
        lat,
        lng,
        area.center.latitude,
        area.center.longitude,
      );
      if (distanceMeters < bestDistance) bestDistance = distanceMeters;
    }
    if (bestDistance > maxDistanceMeters) continue;

    const distanceScore = 1 - Math.min(bestDistance / maxDistanceMeters, 1);
    const rankScore = distanceScore * 0.45;

    candidates.push({ providerId, distanceMeters: bestDistance, rankScore });
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore);
  return candidates.slice(0, input.maxBroadcastProviders);
}

export async function countEligibleUrgentPool(input: {
  serviceId: string;
  coordinates: [number, number];
  maxDistanceKm: number;
  addressForAreaCheck: Pick<
    ICustomerAddress,
    'postalCode' | 'city' | 'location' | 'customerId'
  >;
}): Promise<number> {
  const [online, offline] = await Promise.all([
    matchUrgentProviders({
      ...input,
      maxBroadcastProviders: 200,
      excludeProviderIds: [],
    }),
    matchOfflineUrgentProviders({
      ...input,
      maxBroadcastProviders: 200,
      excludeProviderIds: [],
    }),
  ]);
  const ids = new Set([...online, ...offline].map((m) => m.providerId));
  return ids.size;
}
