import type { IBooking } from '@/models/Booking.js';
import {
  consumeEntitlement,
  releaseEntitlementReservation,
} from '@/modules/care-plans/entitlement.service.js';

export async function consumeEntitlementForBooking(booking: IBooking) {
  const entitlementId = booking.price.entitlementId?.toString();
  if (!entitlementId) return null;
  return consumeEntitlement(entitlementId, booking._id.toString());
}

export async function releaseEntitlementForBooking(booking: IBooking) {
  const entitlementId = booking.price.entitlementId?.toString();
  if (!entitlementId) return null;
  return releaseEntitlementReservation(entitlementId, booking._id.toString());
}
