import { BookingStatus } from '@ghaarfix/shared-types';
import {
  FinancialEventStatus,
  FinancialEventType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import {
  CityFinancialSnapshot,
  FinancialEvent,
  ServiceProfitabilitySnapshot,
} from '@/models/Finance.js';
import {
  bookingCityId,
  bookingDiscountMajor,
  bookingGrossMinor,
  bookingProviderCostMinor,
} from '@/modules/finance/booking-finance.helpers.js';
import { toMinor } from '@/utils/money.js';

function periodBounds(days = 30): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

export async function buildServiceProfitabilitySnapshots(days = 30) {
  const { start, end } = periodBounds(days);
  const bookings = await Booking.find({
    status: BookingStatus.COMPLETED,
    updatedAt: { $gte: start, $lte: end },
  }).select('serviceId serviceZoneSnapshot price');

  const map = new Map<
    string,
    {
      serviceId: string;
      cityId?: string;
      bookings: number;
      gmvMinor: number;
      netRevenueMinor: number;
      contributionMarginMinor: number;
      refundMinor: number;
      providerCostMinor: number;
      discountMinor: number;
    }
  >();

  for (const b of bookings) {
    const cityId = bookingCityId(b);
    const key = `${b.serviceId?.toString() ?? 'unknown'}:${cityId ?? 'all'}`;
    const entry = map.get(key) ?? {
      serviceId: b.serviceId?.toString() ?? 'unknown',
      cityId,
      bookings: 0,
      gmvMinor: 0,
      netRevenueMinor: 0,
      contributionMarginMinor: 0,
      refundMinor: 0,
      providerCostMinor: 0,
      discountMinor: 0,
    };

    const gross = bookingGrossMinor(b.price);
    const discount = toMinor(bookingDiscountMajor(b.price));
    const provider = bookingProviderCostMinor(b.price);
    const net = gross - discount;

    entry.bookings += 1;
    entry.gmvMinor += gross;
    entry.netRevenueMinor += net;
    entry.contributionMarginMinor += net - provider;
    entry.providerCostMinor += provider;
    entry.discountMinor += discount;
    map.set(key, entry);
  }

  let count = 0;
  for (const entry of map.values()) {
    const refundEvents = await FinancialEvent.aggregate([
      {
        $match: {
          serviceId: entry.serviceId,
          eventType: FinancialEventType.REFUND,
          status: FinancialEventStatus.POSTED,
          effectiveAt: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]);
    const claimCostMinor = refundEvents[0]?.total ?? 0;
    const refundRate = entry.gmvMinor > 0 ? claimCostMinor / entry.gmvMinor : 0;

    await ServiceProfitabilitySnapshot.findOneAndUpdate(
      {
        serviceId: entry.serviceId,
        cityId: entry.cityId,
        periodStart: start,
      },
      {
        serviceId: entry.serviceId,
        cityId: entry.cityId,
        periodStart: start,
        periodEnd: end,
        bookings: entry.bookings,
        gmvMinor: entry.gmvMinor,
        netRevenueMinor: entry.netRevenueMinor,
        contributionMarginMinor: entry.contributionMarginMinor,
        refundRate,
        claimCostMinor,
        avgProviderCostMinor: entry.bookings ? Math.round(entry.providerCostMinor / entry.bookings) : 0,
        avgDiscountMinor: entry.bookings ? Math.round(entry.discountMinor / entry.bookings) : 0,
      },
      { upsert: true },
    );
    count += 1;
  }

  return count;
}

export async function buildCityFinancialSnapshots(days = 30) {
  const { start, end } = periodBounds(days);
  const bookings = await Booking.find({
    status: BookingStatus.COMPLETED,
    updatedAt: { $gte: start, $lte: end },
    'serviceZoneSnapshot.cityId': { $exists: true },
  }).select('serviceZoneSnapshot price');

  const map = new Map<string, { gmv: number; revenue: number; payouts: number; discounts: number }>();

  for (const b of bookings) {
    const cityId = bookingCityId(b);
    if (!cityId) continue;
    const entry = map.get(cityId) ?? { gmv: 0, revenue: 0, payouts: 0, discounts: 0 };
    const gross = bookingGrossMinor(b.price);
    const discount = toMinor(bookingDiscountMajor(b.price));
    const payout = bookingProviderCostMinor(b.price);
    entry.gmv += gross;
    entry.revenue += gross - discount;
    entry.payouts += payout;
    entry.discounts += discount;
    map.set(cityId, entry);
  }

  let count = 0;
  for (const [cityId, entry] of map) {
    const refunds = await sumEventForCity(cityId, FinancialEventType.REFUND, start, end);
    await CityFinancialSnapshot.findOneAndUpdate(
      { cityId, periodStart: start },
      {
        cityId,
        periodStart: start,
        periodEnd: end,
        gmvMinor: entry.gmv,
        revenueMinor: entry.revenue,
        providerPayoutsMinor: entry.payouts,
        refundsMinor: refunds,
        discountCostMinor: entry.discounts,
        contributionMarginMinor: entry.revenue - entry.payouts - refunds,
      },
      { upsert: true },
    );
    count += 1;
  }

  return count;
}

async function sumEventForCity(
  cityId: string,
  eventType: FinancialEventType,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await FinancialEvent.aggregate([
    {
      $match: {
        cityId,
        eventType,
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  return rows[0]?.total ?? 0;
}

export async function listServiceProfitability(query: {
  cityId?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.cityId) filter.cityId = query.cityId;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ServiceProfitabilitySnapshot.find(filter).sort({ contributionMarginMinor: 1 }).skip(skip).limit(limit),
    ServiceProfitabilitySnapshot.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function listCityProfitability(query: { page?: number; limit?: number }) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    CityFinancialSnapshot.find().sort({ contributionMarginMinor: 1 }).skip(skip).limit(limit),
    CityFinancialSnapshot.countDocuments(),
  ]);

  return { items, total, page, limit };
}

export async function getLossMakingServices(limit = 10) {
  return ServiceProfitabilitySnapshot.find({ contributionMarginMinor: { $lt: 0 } })
    .sort({ contributionMarginMinor: 1 })
    .limit(limit);
}
