import { AnalyticsReadModelSnapshot } from '@/models/Performance.js';
import { Booking } from '@/models/Booking.js';
import { User } from '@/models/User.js';

const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export async function refreshAdminAnalyticsSnapshot(): Promise<void> {
  const [bookingStats, userStats] = await Promise.all([
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const now = new Date();
  await AnalyticsReadModelSnapshot.findOneAndUpdate(
    { key: 'admin:overview' },
    {
      key: 'admin:overview',
      data: {
        bookingsByStatus: bookingStats,
        usersByRole: userStats,
        computedAt: now.toISOString(),
      },
      computedAt: now,
      expiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
    },
    { upsert: true },
  );
}

export async function getAdminAnalyticsSnapshot(): Promise<Record<string, unknown> | null> {
  const snapshot = await AnalyticsReadModelSnapshot.findOne({
    key: 'admin:overview',
    expiresAt: { $gt: new Date() },
  });
  return snapshot?.data ?? null;
}

export async function invalidateAnalyticsSnapshot(key: string): Promise<void> {
  await AnalyticsReadModelSnapshot.deleteOne({ key });
}
