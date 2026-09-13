import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  findNearbyProviderIds,
  removeProviderGeo,
  upsertProviderGeo,
  URGENT_PROVIDER_GEO_KEY,
} from '@/infra/provider-geo.service.js';
import { closeRedis, getRedisClient, isRedisEnabled } from '@/infra/redis.js';

const describeRedis =
  process.env.REDIS_ENABLED === 'true' && process.env.REDIS_URL ? describe : describe.skip;

describeRedis('provider geo integration', () => {
  beforeAll(async () => {
    if (!isRedisEnabled()) {
      throw new Error('REDIS_ENABLED must be true for provider geo integration tests');
    }
  });

  afterAll(async () => {
    await closeRedis();
  });

  it('indexes providers and finds nearby hits within radius', async () => {
    const providerA = '507f1f77bcf86cd799439021';
    const providerB = '507f1f77bcf86cd799439022';

    await upsertProviderGeo(providerA, 77.5946, 12.9716);
    await upsertProviderGeo(providerB, 77.7, 13.1);

    const hits = await findNearbyProviderIds({
      longitude: 77.5946,
      latitude: 12.9716,
      radiusMeters: 5000,
      limit: 10,
    });

    expect(hits?.some((hit) => hit.providerId === providerA)).toBe(true);
    expect(hits?.some((hit) => hit.providerId === providerB)).toBe(false);

    await removeProviderGeo(providerA);
    await removeProviderGeo(providerB);

    const redis = await getRedisClient();
    await redis?.del(URGENT_PROVIDER_GEO_KEY);
  });
});

describe('provider geo fallback', () => {
  it('returns null when redis is disabled', async () => {
    const redisModule = await import('@/infra/redis.js');
    vi.spyOn(redisModule, 'isRedisEnabled').mockReturnValue(false);

    const hits = await findNearbyProviderIds({
      longitude: 77.5946,
      latitude: 12.9716,
      radiusMeters: 5000,
    });

    expect(hits).toBeNull();
    vi.restoreAllMocks();
  });
});
