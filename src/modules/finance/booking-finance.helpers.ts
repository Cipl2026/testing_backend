import type { IBooking } from '@/models/Booking.js';
import { toMinor } from '@/utils/money.js';

export function bookingDiscountMajor(price: IBooking['price']): number {
  return (
    (price.promotionDiscount ?? 0) +
    (price.rewardCredit ?? 0) +
    (price.subscriptionBenefitAmount ?? 0)
  );
}

export function bookingCityId(booking: Pick<IBooking, 'serviceZoneSnapshot'>): string | undefined {
  return booking.serviceZoneSnapshot?.cityId;
}

export function bookingTaxMajor(_price: IBooking['price']): number {
  return 0;
}

export function bookingGrossMinor(price: IBooking['price']): number {
  return toMinor(price.finalAmount ?? 0);
}

export function bookingProviderCostMinor(price: IBooking['price']): number {
  return toMinor(price.providerPayoutAmount ?? price.finalAmount ?? 0);
}
