import type { Store, Options, ClientRateLimitInfo, IncrementResponse } from 'express-rate-limit';
import { getRedisClient, isRedisEnabled } from '@/infra/redis.js';

const PREFIX = 'ghaarfix:rl:';

class RedisRateLimitStore implements Store {
  prefix: string;
  windowMs: number;

  constructor(windowMs: number) {
    this.prefix = PREFIX;
    this.windowMs = windowMs;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = await getRedisClient();
    if (!redis) {
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
    const redisKey = `${this.prefix}${key}`;
    const totalHits = await redis.incr(redisKey);
    if (totalHits === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.decr(`${this.prefix}${key}`);
  }

  async resetKey(key: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.del(`${this.prefix}${key}`);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redis = await getRedisClient();
    if (!redis) return undefined;
    const totalHits = Number(await redis.get(`${this.prefix}${key}`));
    if (!totalHits) return undefined;
    const ttl = await redis.pttl(`${this.prefix}${key}`);
    return {
      totalHits,
      resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
    };
  }
}

export function createRateLimitStore(windowMs: number): Store | undefined {
  if (!isRedisEnabled()) return undefined;
  return new RedisRateLimitStore(windowMs);
}
