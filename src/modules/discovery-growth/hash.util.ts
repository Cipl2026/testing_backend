import { createHash } from 'node:crypto';

export function deterministicBucket(customerId: string, key: string, bucketCount = 100): number {
  const hash = createHash('sha256').update(`${customerId}:${key}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16) % bucketCount;
}

export function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function generateReferralCode(customerId: string): string {
  const hash = createHash('sha256').update(customerId).digest('hex').slice(0, 8).toUpperCase();
  return `GF${hash}`;
}
