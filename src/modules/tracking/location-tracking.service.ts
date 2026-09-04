import { BookingStatus, ErrorCode, EtaSource, TrackingState } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { BookingLocation } from '@/models/BookingLocation.js';
import { distanceMeters, toGeoPoint, validateCoordinates } from '@/utils/geo.js';
import { AppError } from '@/utils/AppError.js';
import {
  emitBookingEtaUpdated,
  emitBookingLocationUpdated,
} from '@/modules/realtime/socket.service.js';

interface LocationInput {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  recordedAt?: string;
}

const lastHistoryWrite = new Map<string, number>();

function trackingStateFromStatus(status: BookingStatus): boolean {
  return status === BookingStatus.PROVIDER_EN_ROUTE;
}

export async function updateProviderBookingLocation(
  providerId: string,
  bookingId: string,
  input: LocationInput,
) {
  validateCoordinates(input.latitude, input.longitude);

  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (!trackingStateFromStatus(booking.status)) {
    throw new AppError('Location updates only allowed while en route.', 409, ErrorCode.CONFLICT);
  }

  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();
  const maxAgeMs = env.tracking.maxLocationAgeMinutes * 60 * 1000;
  if (Date.now() - recordedAt.getTime() > maxAgeMs) {
    throw new AppError('Location timestamp is too stale.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const geoPoint = toGeoPoint({ latitude: input.latitude, longitude: input.longitude });

  const prevCoords = booking.tracking?.currentLocation?.coordinates;
  let shouldWriteHistory = true;
  const lastWrite = lastHistoryWrite.get(bookingId) ?? 0;
  const now = Date.now();

  if (prevCoords) {
    const moved = distanceMeters(
      { latitude: prevCoords[1], longitude: prevCoords[0] },
      { latitude: input.latitude, longitude: input.longitude },
    );
    const timeOk = now - lastWrite >= env.tracking.minHistoryIntervalSeconds * 1000;
    const distOk = moved >= env.tracking.minHistoryDistanceMeters;
    shouldWriteHistory = timeOk && distOk;
  }

  if (!booking.tracking) {
    booking.tracking = { state: TrackingState.EN_ROUTE };
  }
  booking.tracking.currentLocation = geoPoint;
  booking.tracking.locationUpdatedAt = recordedAt;
  if (booking.status === BookingStatus.PROVIDER_EN_ROUTE) {
    booking.tracking.state = TrackingState.EN_ROUTE;
  }
  await booking.save();

  if (shouldWriteHistory) {
    await BookingLocation.create({
      bookingId,
      providerId,
      location: geoPoint,
      recordedAt,
      source: 'provider_app',
      accuracyMeters: input.accuracyMeters,
    });
    lastHistoryWrite.set(bookingId, now);
  }

  const payload = {
    bookingId,
    latitude: input.latitude,
    longitude: input.longitude,
    updatedAt: recordedAt.toISOString(),
    accuracyMeters: input.accuracyMeters,
  };

  emitBookingLocationUpdated(booking.customerId.toString(), payload);

  return payload;
}

export async function getCustomerTracking(customerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const canTrack = booking.status === BookingStatus.PROVIDER_EN_ROUTE;
  const coords = booking.tracking?.currentLocation?.coordinates;

  return {
    bookingId,
    status: booking.status,
    trackingActive: canTrack,
    currentLocation: canTrack && coords
      ? {
          latitude: coords[1],
          longitude: coords[0],
          updatedAt: booking.tracking?.locationUpdatedAt?.toISOString(),
        }
      : null,
    destination: booking.addressSnapshot.location
      ? {
          latitude: booking.addressSnapshot.location.latitude,
          longitude: booking.addressSnapshot.location.longitude,
        }
      : null,
    provider: {
      fullName: booking.providerSnapshot.fullName,
      profileImage: booking.providerSnapshot.profileImage,
    },
    service: { name: booking.serviceSnapshot.name },
  };
}

export async function stopTrackingOnArrival(bookingId: string): Promise<void> {
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        'tracking.state': TrackingState.ARRIVED,
      },
      $unset: { 'tracking.currentLocation': 1 },
    },
  );
  lastHistoryWrite.delete(bookingId);
}

export async function cleanupOldLocationHistory(): Promise<number> {
  const cutoff = new Date(Date.now() - env.tracking.locationRetentionDays * 24 * 60 * 60 * 1000);
  const result = await BookingLocation.deleteMany({ recordedAt: { $lt: cutoff } });
  return result.deletedCount ?? 0;
}

// ETA cache per booking
const etaCache = new Map<string, { updatedAt: number; result: EtaResult }>();

export interface EtaResult {
  distanceMeters: number | null;
  durationSeconds: number | null;
  source: EtaSource;
  updatedAt: string;
  message?: string;
}

export async function calculateBookingEta(customerId: string, bookingId: string): Promise<EtaResult> {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (booking.status !== BookingStatus.PROVIDER_EN_ROUTE) {
    return {
      distanceMeters: null,
      durationSeconds: null,
      source: EtaSource.UNAVAILABLE,
      updatedAt: new Date().toISOString(),
      message: 'ETA available only while professional is en route.',
    };
  }

  const dest = booking.addressSnapshot.location;
  const originCoords = booking.tracking?.currentLocation?.coordinates;
  if (!dest || !originCoords) {
    return {
      distanceMeters: null,
      durationSeconds: null,
      source: EtaSource.UNAVAILABLE,
      updatedAt: new Date().toISOString(),
      message: 'Location updated recently.',
    };
  }

  const origin = { latitude: originCoords[1], longitude: originCoords[0] };
  const cached = etaCache.get(bookingId);
  const now = Date.now();

  if (cached) {
    const moved = distanceMeters(origin, {
      latitude: cached.result.distanceMeters ? origin.latitude : origin.latitude,
      longitude: origin.longitude,
    });
    const timeOk = now - cached.updatedAt < env.tracking.etaRefreshSeconds * 1000;
    if (timeOk && moved < env.tracking.etaDistanceThresholdMeters) {
      return cached.result;
    }
  }

  const dist = distanceMeters(origin, dest);
  let result: EtaResult;

  if (env.maps.googleApiKey) {
    try {
      const routed = await fetchGoogleEta(origin, dest);
      result = routed;
    } catch {
      result = straightLineFallback(dist);
    }
  } else {
    result = straightLineFallback(dist);
  }

  etaCache.set(bookingId, { updatedAt: now, result });
  emitBookingEtaUpdated(customerId, { bookingId, ...result });
  return result;
}

function straightLineFallback(distance: number): EtaResult {
  return {
    distanceMeters: Math.round(distance),
    durationSeconds: null,
    source: EtaSource.STRAIGHT_LINE,
    updatedAt: new Date().toISOString(),
    message: 'Live route estimate unavailable.',
  };
}

async function fetchGoogleEta(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): Promise<EtaResult> {
  const key = env.maps.googleApiKey;
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  url.searchParams.set('destination', `${dest.latitude},${dest.longitude}`);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    routes?: Array<{ legs?: Array<{ distance: { value: number }; duration: { value: number } }> }>;
  };
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) return straightLineFallback(distanceMeters(origin, dest));

  return {
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    source: EtaSource.ROUTING_API,
    updatedAt: new Date().toISOString(),
  };
}
