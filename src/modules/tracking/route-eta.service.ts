import { env } from '@/config/env.js';

/**
 * Road-based ETA estimation (Phase 6 · Gap fix: "Provider ETA + distance separation").
 *
 * Matching/dispatch always uses the aerial (geospatial) distance
 * (`distanceMeters` from the matching service). This module provides the ROAD
 * distance + travel-time estimate used ONLY for UI ETAs, preferring the Google
 * Directions API when a key is configured and falling back to a straight-line
 * heuristic otherwise. Results are cached in-memory for a short window so we
 * never hammer the routing API per identity notification.
 */

export type RouteEtaSource = 'ROUTING_API' | 'STRAIGHT_LINE';

export interface RouteEtaResult {
  distanceMeters: number;
  durationSeconds: number | null;
  source: RouteEtaSource;
}

interface CachedEta {
  updatedAt: number;
  result: RouteEtaResult;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CachedEta>();

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function roundCoord(value: number): number {
  return Math.round(value * 1e3) / 1e3;
}

function cacheKey(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): string {
  return (
    `${roundCoord(origin.latitude)},${roundCoord(origin.longitude)}|` +
    `${roundCoord(dest.latitude)},${roundCoord(dest.longitude)}`
  );
}

function straightLine(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): RouteEtaResult {
  return {
    distanceMeters: Math.round(
      haversineMeters(origin.latitude, origin.longitude, dest.latitude, dest.longitude),
    ),
    durationSeconds: null,
    source: 'STRAIGHT_LINE',
  };
}

async function fetchGoogleDirections(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): Promise<RouteEtaResult> {
  const key = env.maps.googleApiKey;
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  url.searchParams.set('destination', `${dest.latitude},${dest.longitude}`);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    routes?: Array<{
      legs?: Array<{ distance: { value: number }; duration: { value: number } }>;
    }>;
  };
  const leg = data.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error('No route found');
  return {
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    source: 'ROUTING_API',
  };
}

/**
 * Return road distance + duration. Will never throw: routing failures or missing
 * keys fall back to an aerial estimate.
 */
export async function estimateRouteEta(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): Promise<RouteEtaResult> {
  const key = cacheKey(origin, dest);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  let result: RouteEtaResult;
  if (env.maps.googleApiKey) {
    try {
      result = await fetchGoogleDirections(origin, dest);
    } catch {
      result = straightLine(origin, dest);
    }
  } else {
    result = straightLine(origin, dest);
  }

  cache.set(key, { updatedAt: Date.now(), result });
  return result;
}

/** Convert a route result to a whole-minute ETA, falling back to aerial distance. */
export function routeEtaMinutes(
  result: RouteEtaResult,
  aerialFallbackMeters: number,
): number {
  if (result.durationSeconds && result.durationSeconds > 0) {
    return Math.max(1, Math.round(result.durationSeconds / 60));
  }
  const meters = result.distanceMeters > 0 ? result.distanceMeters : aerialFallbackMeters;
  return Math.max(1, Math.round(meters / 500));
}