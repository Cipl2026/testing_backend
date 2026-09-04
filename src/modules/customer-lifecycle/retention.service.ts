import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { User } from '@/models/User.js';
import { CohortSnapshot } from '@/models/CustomerLifecycle.js';

function cohortKey(month: Date): string {
  return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function buildSignupCohorts(months = 6): Promise<number> {
  let count = 0;
  const now = new Date();

  for (let i = 0; i < months; i += 1) {
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));

    const customers = await User.find({
      createdAt: { $gte: periodStart, $lte: periodEnd },
      role: 'CUSTOMER',
    }).select('_id createdAt');

    if (customers.length < 5) continue;

    const customerIds = customers.map((c) => c._id);
    const retention = await computeRetention(customerIds, periodStart);

    await CohortSnapshot.findOneAndUpdate(
      { cohortKey: `signup:${cohortKey(periodStart)}`, periodStart },
      {
        cohortKey: `signup:${cohortKey(periodStart)}`,
        periodStart,
        periodEnd,
        cohortSize: customers.length,
        ...retention,
        calculatedAt: new Date(),
        metadata: { type: 'signup_month' },
      },
      { upsert: true },
    );
    count += 1;
  }

  return count;
}

async function computeRetention(customerIds: unknown[], cohortStart: Date) {
  const d1End = new Date(cohortStart.getTime() + 1 * 24 * 60 * 60 * 1000);
  const d7End = new Date(cohortStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const d30End = new Date(cohortStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const d90End = new Date(cohortStart.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [d1, d7, d30, d90, repeat] = await Promise.all([
    countActive(customerIds, cohortStart, d1End),
    countActive(customerIds, cohortStart, d7End),
    countActive(customerIds, cohortStart, d30End),
    countActive(customerIds, cohortStart, d90End),
    countRepeat(customerIds),
  ]);

  const size = customerIds.length || 1;
  return {
    retentionD1: d1 / size,
    retentionD7: d7 / size,
    retentionD30: d30 / size,
    retentionD90: d90 / size,
    repeatRate: repeat / size,
  };
}

async function countActive(customerIds: unknown[], from: Date, to: Date): Promise<number> {
  const active = await Booking.distinct('customerId', {
    customerId: { $in: customerIds },
    status: BookingStatus.COMPLETED,
    updatedAt: { $gte: from, $lte: to },
  });
  return active.length;
}

async function countRepeat(customerIds: unknown[]): Promise<number> {
  const rows = await Booking.aggregate([
    { $match: { customerId: { $in: customerIds }, status: BookingStatus.COMPLETED } },
    { $group: { _id: '$customerId', count: { $sum: 1 } } },
    { $match: { count: { $gte: 2 } } },
  ]);
  return rows.length;
}

export async function getRetentionOverview() {
  const cohorts = await CohortSnapshot.find().sort({ periodStart: -1 }).limit(12);
  const avg = cohorts.reduce(
    (acc, c) => ({
      d1: acc.d1 + c.retentionD1,
      d7: acc.d7 + c.retentionD7,
      d30: acc.d30 + c.retentionD30,
      d90: acc.d90 + c.retentionD90,
      repeat: acc.repeat + c.repeatRate,
      n: acc.n + 1,
    }),
    { d1: 0, d7: 0, d30: 0, d90: 0, repeat: 0, n: 0 },
  );

  const n = avg.n || 1;
  return {
    cohorts,
    averages: {
      retentionD1: avg.d1 / n,
      retentionD7: avg.d7 / n,
      retentionD30: avg.d30 / n,
      retentionD90: avg.d90 / n,
      repeatRate: avg.repeat / n,
    },
  };
}

export async function getTimeToSecondBooking() {
  const rows = await Booking.aggregate([
    { $match: { status: BookingStatus.COMPLETED } },
    { $sort: { updatedAt: 1 } },
    {
      $group: {
        _id: '$customerId',
        dates: { $push: '$updatedAt' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: 2 } } },
    {
      $project: {
        daysToSecond: {
          $divide: [
            { $subtract: [{ $arrayElemAt: ['$dates', 1] }, { $arrayElemAt: ['$dates', 0] }] },
            1000 * 60 * 60 * 24,
          ],
        },
      },
    },
    { $group: { _id: null, avgDays: { $avg: '$daysToSecond' } } },
  ]);

  return { avgDaysToSecondBooking: rows[0]?.avgDays ?? null };
}
