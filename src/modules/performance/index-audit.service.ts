import mongoose from 'mongoose';
import { IndexRecommendation } from '@/models/Performance.js';
import { IndexRecommendationStatus } from '@ghaarfix/shared-types';

const KNOWN_RECOMMENDATIONS = [
  {
    collectionName: 'bookings',
    queryPattern: '{ customerId: ?, status: ?, createdAt: -1 }',
    recommendedIndex: { customerId: 1, status: 1, createdAt: -1 },
    reason: 'Customer booking list with status filter',
    estimatedImpact: 'HIGH',
  },
  {
    collectionName: 'bookings',
    queryPattern: '{ providerId: ?, status: ?, scheduledAt: 1 }',
    recommendedIndex: { providerId: 1, status: 1, scheduledAt: 1 },
    reason: 'Provider schedule queries',
    estimatedImpact: 'HIGH',
  },
  {
    collectionName: 'providerpresences',
    queryPattern: '{ currentLocation: $nearSphere, isOnline: true }',
    recommendedIndex: { currentLocation: '2dsphere', isOnline: 1, urgentAvailable: 1 },
    reason: 'Urgent matching geo query',
    estimatedImpact: 'CRITICAL',
  },
  {
    collectionName: 'urgentrequests',
    queryPattern: '{ status: ?, createdAt: -1 }',
    recommendedIndex: { status: 1, createdAt: -1 },
    reason: 'Admin urgent request listing',
    estimatedImpact: 'MEDIUM',
  },
  {
    collectionName: 'notifications',
    queryPattern: '{ userId: ?, createdAt: -1 }',
    recommendedIndex: { userId: 1, createdAt: -1 },
    reason: 'User notification history pagination',
    estimatedImpact: 'MEDIUM',
  },
];

export async function seedIndexRecommendations(): Promise<void> {
  for (const rec of KNOWN_RECOMMENDATIONS) {
    await IndexRecommendation.findOneAndUpdate(
      { collectionName: rec.collectionName, queryPattern: rec.queryPattern },
      { ...rec, status: IndexRecommendationStatus.PENDING },
      { upsert: true },
    );
  }
}

export async function listIndexRecommendations(status?: IndexRecommendationStatus) {
  const query = status ? { status } : {};
  const rows = await IndexRecommendation.find(query).sort({ createdAt: -1 });
  return rows.map((r) => ({
    id: r._id.toString(),
    collection: r.collectionName,
    queryPattern: r.queryPattern,
    recommendedIndex: r.recommendedIndex,
    reason: r.reason,
    estimatedImpact: r.estimatedImpact,
    status: r.status,
    reviewedAt: r.reviewedAt,
  }));
}

export async function reviewIndexRecommendation(
  id: string,
  status: IndexRecommendationStatus,
  reviewerId?: string,
) {
  const update: Record<string, unknown> = { status, reviewedAt: new Date() };
  if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
    update.reviewedBy = new mongoose.Types.ObjectId(reviewerId);
  }
  return IndexRecommendation.findByIdAndUpdate(id, update, { new: true });
}

export async function auditExistingIndexes(): Promise<
  Array<{ collection: string; indexes: string[]; count: number }>
> {
  const db = mongoose.connection.db;
  if (!db) return [];
  const collections = await db.listCollections().toArray();
  const results: Array<{ collection: string; indexes: string[]; count: number }> = [];
  for (const col of collections.slice(0, 30)) {
    const indexes = await db.collection(col.name).indexes();
    results.push({
      collection: col.name,
      indexes: indexes.map((i) => JSON.stringify(i.key)),
      count: indexes.length,
    });
  }
  return results;
}
