import { ProviderPresenceStatus } from '@ghaarfix/shared-types';
import { getRedisClient, isRedisEnabled } from '@/infra/redis.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';
import { logger } from '@/utils/logger.js';

export const URGENT_PROVIDER_GEO_KEY = 'ghaarfix:providers:urgent:geo';

export type NearbyProviderGeoHit = {
  providerId: string;
  distanceMeters: number;
};

export async function upsertProviderGeo(
  providerId: string,
  longitude: number,
  latitude: number,
): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.geoadd(URGENT_PROVIDER_GEO_KEY, longitude, latitude, providerId);
  } catch (error) {
    logger.warn('Failed to upsert provider geo index', { providerId, error: String(error) });
  }
}

export async function removeProviderGeo(providerId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    await redis.zrem(URGENT_PROVIDER_GEO_KEY, providerId);
  } catch (error) {
    logger.warn('Failed to remove provider geo index', { providerId, error: String(error) });
  }
}

export async function findNearbyProviderIds(input: {
  longitude: number;
  latitude: number;
  radiusMeters: number;
  limit?: number;
}): Promise<NearbyProviderGeoHit[] | null> {
  if (!isRedisEnabled()) return null;
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const rows = (await redis.georadius(
      URGENT_PROVIDER_GEO_KEY,
      input.longitude,
      input.latitude,
      input.radiusMeters,
      'm',
      'WITHDIST',
      'ASC',
      'COUNT',
      input.limit ?? 100,
    )) as Array<[string, string]> | null;

    if (!rows?.length) return [];

    return rows.map(([providerId, distance]) => ({
      providerId,
      distanceMeters: Number(distance),
    }));
  } catch (error) {
    logger.warn('Redis GEO search failed; falling back to Mongo geospatial query', {
      error: String(error),
    });
    return null;
  }
}

export async function rebuildProviderGeoIndex(): Promise<number> {
  if (!isRedisEnabled()) return 0;
  const redis = await getRedisClient();
  if (!redis) return 0;

  const presences = await ProviderPresence.find({
    isOnline: true,
    urgentAvailable: true,
    status: ProviderPresenceStatus.ONLINE,
    currentLocation: { $exists: true },
  })
    .select('providerId currentLocation')
    .limit(5000);

  try {
    await redis.del(URGENT_PROVIDER_GEO_KEY);
  } catch (error) {
    logger.warn('Failed to clear provider geo index before rebuild', { error: String(error) });
  }

  let indexed = 0;
  for (const presence of presences) {
    const coords = presence.currentLocation?.coordinates;
    if (!coords?.length) continue;
    const [longitude, latitude] = coords;
    await upsertProviderGeo(presence.providerId.toString(), longitude, latitude);
    indexed += 1;
  }

  if (indexed > 0) {
    logger.info('Rebuilt urgent provider GEO index', { indexed });
  }
  return indexed;
}
