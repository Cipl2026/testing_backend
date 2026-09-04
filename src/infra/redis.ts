import { Redis } from 'ioredis';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

let client: Redis | null = null;
let connectAttempted = false;

export function isRedisEnabled(): boolean {
  return Boolean(env.redis.enabled && env.redis.url);
}

export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisEnabled()) return null;
  if (client) return client;
  if (connectAttempted) return client;

  connectAttempted = true;
  try {
    client = new Redis(env.redis.url!, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await client.connect();
    client.on('error', (error: Error) => {
      logger.error('Redis client error', { error: String(error) });
    });
    logger.info('Redis connected');
    return client;
  } catch (error) {
    logger.warn('Redis unavailable; running without cache/queues', { error: String(error) });
    client = null;
    return null;
  }
}

export async function pingRedis(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  } finally {
    client = null;
    connectAttempted = false;
  }
}
