import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { getProviderSettlementSummary } from '@/modules/settlements/provider-settlement.service.js';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function aggregateEarnings(providerId: string, since: Date) {
  const rows = await Booking.aggregate([
    {
      $match: {
        providerId,
        status: BookingStatus.COMPLETED,
        updatedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: null,
        amount: {
          $sum: {
            $ifNull: ['$price.providerPayoutAmount', '$price.finalAmount'],
          },
        },
        jobs: { $sum: 1 },
      },
    },
  ]);

  return {
    amount: Math.round(rows[0]?.amount ?? 0),
    jobs: rows[0]?.jobs ?? 0,
  };
}

export async function getProviderEarnings(providerId: string) {
  const todayStart = startOfDay(new Date());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  const [today, week, month, settlementSummary, recentBookings] = await Promise.all([
    aggregateEarnings(providerId, todayStart),
    aggregateEarnings(providerId, weekStart),
    aggregateEarnings(providerId, monthStart),
    getProviderSettlementSummary(providerId),
    Booking.find({ providerId, status: BookingStatus.COMPLETED })
      .sort({ updatedAt: -1 })
      .limit(12)
      .select('serviceSnapshot price updatedAt bookingNumber'),
  ]);

  return {
    today,
    week,
    month,
    pendingPayout: settlementSummary.pendingPayout,
    pendingCommission: settlementSummary.pendingCommission,
    customerPaymentPending: settlementSummary.customerPaymentPending,
    settledPayout: settlementSummary.settledPayout,
    settledCommission: settlementSummary.settledCommission,
    recentTransactions: recentBookings.map((booking) => ({
      id: booking._id.toString(),
      label: booking.serviceSnapshot?.name ?? booking.bookingNumber,
      amount: Math.round(booking.price?.providerPayoutAmount ?? booking.price?.finalAmount ?? 0),
      time: booking.updatedAt.toISOString(),
    })),
  };
}
