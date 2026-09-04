import { env } from '@/config/env.js';
import { getRedisClient, isRedisEnabled } from '@/infra/redis.js';
import { logger } from '@/utils/logger.js';
import { cacheMetrics } from '@/modules/performance/cache-metrics.service.js';

const KEY_PREFIX = 'ghaarfix:';
const inflight = new Map<string, Promise<unknown>>();

export const CacheCatalog = {
  CATALOG_SERVICES: 'catalog:services',
  CATALOG_CATEGORIES: 'catalog:categories',
  FEATURE_FLAGS: 'feature-flags',
  SERVICE_ZONES: 'service-zones',
  ZONE_AVAILABILITY: 'zone-availability',
} as const;

function namespacedKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisEnabled()) return null;
  const redis = await getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(namespacedKey(key));
    if (!raw) {
      cacheMetrics.recordMiss(key);
      return null;
    }
    cacheMetrics.recordHit(key);
    return JSON.parse(raw) as T;
  } catch (error) {
    cacheMetrics.recordError(key);
    logger.warn('Cache get failed', { key, error: String(error) });
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds = env.cache.ttlSeconds,
): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.set(namespacedKey(key), JSON.stringify(value), 'EX', ttlSeconds);
    cacheMetrics.recordSet(key);
  } catch (error) {
    cacheMetrics.recordError(key);
    logger.warn('Cache set failed', { key, error: String(error) });
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.del(namespacedKey(key));
  } catch (error) {
    logger.warn('Cache del failed', { key, error: String(error) });
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  if (!isRedisEnabled()) return 0;
  const redis = await getRedisClient();
  if (!redis) return 0;
  const fullPattern = namespacedKey(pattern);
  let cursor = '0';
  let deleted = 0;
  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  } catch (error) {
    logger.warn('Cache invalidate failed', { pattern, error: String(error) });
    return deleted;
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds = env.cache.ttlSeconds,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await factory();
      await cacheSet(key, value, ttlSeconds);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
