import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { CustomerValueSnapshot } from '@/models/Finance.js';
import { toMinor } from '@/utils/money.js';
import { rebuildBookingFinancialSnapshot } from '@/modules/finance/booking-economics.service.js';

export async function calculateCustomerValue(customerId: string) {
  const bookings = await Booking.find({
    customerId,
    status: BookingStatus.COMPLETED,
  }).sort({ updatedAt: 1 });

  let netRevenueMinor = 0;
  let contributionMarginMinor = 0;

  for (const b of bookings) {
    const snap = await rebuildBookingFinancialSnapshot(b._id.toString());
    if (snap) {
      netRevenueMinor += snap.netRevenueMinor;
      contributionMarginMinor += snap.contributionMarginMinor;
    } else {
      const gross = toMinor(b.price?.finalAmount ?? 0);
      const provider = toMinor(b.price?.providerPayoutAmount ?? b.price?.finalAmount ?? 0);
      netRevenueMinor += gross;
      contributionMarginMinor += gross - provider;
    }
  }

  const completedBookings = bookings.length;
  const repeatRate = completedBookings > 1 ? (completedBookings - 1) / completedBookings : 0;
  const realizedLtvMinor = netRevenueMinor;
  const predictedLtvMinor =
    completedBookings > 0
      ? Math.round((realizedLtvMinor / completedBookings) * (1 + repeatRate * 2))
      : 0;
  const ltvConfidence = completedBookings >= 3 ? 0.8 : completedBookings >= 1 ? 0.5 : 0.2;

  return CustomerValueSnapshot.findOneAndUpdate(
    { customerId },
    {
      completedBookings,
      netRevenueMinor,
      contributionMarginMinor,
      retentionRate: repeatRate,
      repeatRate,
      realizedLtvMinor,
      predictedLtvMinor,
      ltvConfidence,
    },
    { upsert: true, new: true },
  );
}

export async function calculateAllCustomerValues(limit = 100): Promise<number> {
  const customers = await Booking.distinct('customerId', { status: BookingStatus.COMPLETED });
  let count = 0;
  for (const customerId of customers.slice(0, limit)) {
    await calculateCustomerValue(customerId.toString());
    count += 1;
  }
  return count;
}

export async function getCustomerEconomicsSummary() {
  const rows = await CustomerValueSnapshot.aggregate([
    {
      $group: {
        _id: null,
        customers: { $sum: 1 },
        totalRealizedLtvMinor: { $sum: '$realizedLtvMinor' },
        avgRepeatRate: { $avg: '$repeatRate' },
      },
    },
  ]);

  return {
    customers: rows[0]?.customers ?? 0,
    totalRealizedLtvMinor: rows[0]?.totalRealizedLtvMinor ?? 0,
    avgRepeatRate: rows[0]?.avgRepeatRate ?? 0,
  };
}
