import type { IBooking } from '@/models/Booking.js';

function buildPricePayload(booking: IBooking, audience: 'customer' | 'provider' = 'customer') {
  const providerPayout =
    booking.price.providerPayoutAmount ??
    booking.price.customerJobSubtotal ??
    booking.price.baseAmount ??
    booking.price.estimatedAmount;
  const platformFee = booking.price.platformFeeAmount ?? 0;
  const urgentSurcharge = booking.price.urgentSurcharge ?? booking.price.visitCharge ?? 0;
  const jobSubtotal =
    booking.price.jobSubtotal ??
    (booking.price.baseAmount ?? booking.price.estimatedAmount) + urgentSurcharge;

  const carePlanBenefit =
    booking.price.entitlementId != null
      ? {
          applied: true,
          label: booking.price.carePlanBenefitLabel ?? 'Care Plan benefit',
          customerAmount: booking.price.finalAmount,
          providerPayoutAmount: providerPayout,
          subscriptionBenefitAmount: booking.price.subscriptionBenefitAmount ?? 0,
        }
      : undefined;

  if (audience === 'provider') {
    return {
      ...booking.price,
      finalAmount: providerPayout,
      providerEarnings: providerPayout,
      providerPayoutAmount: providerPayout,
      customerPayableAmount: booking.price.finalAmount,
      platformFeeAmount: platformFee,
      urgentSurcharge,
      jobSubtotal,
      customerJobSubtotal: booking.price.customerJobSubtotal ?? jobSubtotal,
      carePlanBenefit,
      displayNote: 'Your earnings after platform fee (15%)',
    };
  }

  return {
    ...booking.price,
    platformFeeAmount: platformFee,
    urgentSurcharge,
    jobSubtotal,
    customerJobSubtotal: booking.price.customerJobSubtotal ?? jobSubtotal,
    providerEarnings: providerPayout,
    carePlanBenefit,
  };
}

export function serializeBookingSummary(booking: IBooking, audience: 'customer' | 'provider' = 'customer') {
  return {
    id: booking._id.toString(),
    bookingNumber: booking.bookingNumber,
    bookingType: booking.bookingType,
    source: booking.source,
    status: booking.status,
    providerRequestStatus: booking.providerRequestStatus,
    providerResponseExpiresAt: booking.providerResponseExpiresAt?.toISOString(),
    providerRequestExpiredAt: booking.providerRequestExpiredAt?.toISOString(),
    service: booking.serviceSnapshot,
    provider: booking.providerSnapshot,
    address: booking.addressSnapshot,
    scheduledStart: booking.scheduledStart.toISOString(),
    scheduledEnd: booking.scheduledEnd.toISOString(),
    timezone: booking.timezone,
    durationMinutes: booking.durationMinutes,
    price: buildPricePayload(booking, audience),
    organizationContext:
      booking.organizationId != null
        ? {
            organizationId: booking.organizationId.toString(),
            managedPropertyId: booking.managedPropertyId?.toString(),
            propertyUnitId: booking.propertyUnitId?.toString(),
            bookingContextType: booking.bookingContextType,
          }
        : undefined,
    payment: booking.payment,
    customerNotes: booking.customerNotes,
    homeId: booking.homeId?.toString(),
    assetId: booking.assetId?.toString(),
    assetSnapshot: booking.assetSnapshot,
    homeHelp: booking.homeHelp
      ? {
          durationLabel: booking.homeHelp.durationLabel,
          durationMinutes: booking.homeHelp.durationMinutes,
          generalNotes: booking.homeHelp.generalNotes,
          tasks: booking.homeHelp.tasks.map((task) => ({
            serviceId: task.serviceId.toString(),
            name: task.name,
            priority: task.priority,
            notes: task.notes,
          })),
        }
      : undefined,
    createdAt: booking.createdAt.toISOString(),
  };
}

export function serializeBookingDetail(
  booking: IBooking,
  timeline: unknown[],
  extras?: Record<string, unknown>,
  audience: 'customer' | 'provider' = 'customer',
) {
  return {
    ...serializeBookingSummary(booking, audience),
    providerId: booking.providerId.toString(),
    serviceId: booking.serviceId.toString(),
    cancellation: booking.cancellation,
    reschedule: booking.reschedule,
    timeline,
    ...extras,
  };
}
