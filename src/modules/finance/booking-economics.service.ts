import { FinancialEventStatus, FinancialEventType } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { BookingFinancialSnapshot } from '@/models/Finance.js';
import { FinancialEvent } from '@/models/Finance.js';
import { toMinor } from '@/utils/money.js';

export interface UnitEconomicsResult {
  grossRevenueMinor: number;
  discountMinor: number;
  refundMinor: number;
  gatewayFeeMinor: number;
  providerCostMinor: number;
  partCostMinor: number;
  guaranteeCostMinor: number;
  netRevenueMinor: number;
  contributionMarginMinor: number;
}

export function calculateUnitEconomics(input: {
  grossRevenueMinor: number;
  discountMinor: number;
  refundMinor: number;
  gatewayFeeMinor: number;
  providerCostMinor: number;
  partCostMinor: number;
  guaranteeCostMinor: number;
  supportCostMinor?: number;
}): UnitEconomicsResult {
  const netRevenueMinor = input.grossRevenueMinor - input.discountMinor - input.refundMinor;
  const variableCosts =
    input.providerCostMinor +
    input.gatewayFeeMinor +
    input.guaranteeCostMinor +
    input.partCostMinor +
    (input.supportCostMinor ?? 0);
  const contributionMarginMinor = netRevenueMinor - variableCosts;

  return {
    grossRevenueMinor: input.grossRevenueMinor,
    discountMinor: input.discountMinor,
    refundMinor: input.refundMinor,
    gatewayFeeMinor: input.gatewayFeeMinor,
    providerCostMinor: input.providerCostMinor,
    partCostMinor: input.partCostMinor,
    guaranteeCostMinor: input.guaranteeCostMinor,
    netRevenueMinor,
    contributionMarginMinor,
  };
}

export async function rebuildBookingFinancialSnapshot(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const events = await FinancialEvent.find({
    bookingId,
    status: FinancialEventStatus.POSTED,
  });

  const sum = (types: FinancialEventType[]) =>
    events
      .filter((e) => types.includes(e.eventType))
      .reduce((acc, e) => acc + e.amountMinor, 0);

  const grossRevenueMinor =
    sum([FinancialEventType.SERVICE_REVENUE, FinancialEventType.PART_REVENUE]) ||
    toMinor(booking.price?.finalAmount ?? 0);
  const discountMinor = sum([FinancialEventType.DISCOUNT, FinancialEventType.COUPON_COST]);
  const refundMinor = sum([FinancialEventType.REFUND, FinancialEventType.PAYMENT_REFUNDED]);
  const gatewayFeeMinor = sum([FinancialEventType.GATEWAY_FEE]);
  const providerCostMinor = sum([FinancialEventType.PROVIDER_EARNING]);
  const partCostMinor = sum([FinancialEventType.PART_REVENUE]);
  const guaranteeCostMinor = sum([
    FinancialEventType.GUARANTEE_COST,
    FinancialEventType.CLAIM_COST,
  ]);

  const economics = calculateUnitEconomics({
    grossRevenueMinor,
    discountMinor,
    refundMinor,
    gatewayFeeMinor,
    providerCostMinor,
    partCostMinor,
    guaranteeCostMinor,
  });

  const existing = await BookingFinancialSnapshot.findOne({ bookingId });
  const version = (existing?.version ?? 0) + 1;

  return BookingFinancialSnapshot.findOneAndUpdate(
    { bookingId },
    {
      ...economics,
      currency: booking.price?.currency ?? 'INR',
      version,
    },
    { upsert: true, new: true },
  );
}

export async function getBookingEconomics(bookingId: string) {
  const snapshot = await BookingFinancialSnapshot.findOne({ bookingId });
  if (snapshot) return snapshot;

  return rebuildBookingFinancialSnapshot(bookingId);
}
