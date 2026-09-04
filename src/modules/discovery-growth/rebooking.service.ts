import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Service } from '@/models/Service.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

export async function getRebookingPrefill(customerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) {
    throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  }

  const service = await Service.findById(booking.serviceId);
  if (!service?.isActive) {
    throw new AppError('Service is no longer available.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const currentPricing = {
    type: service.pricing.type,
    startingPrice: service.pricing.startingPrice,
    currency: service.pricing.currency,
  };

  return {
    serviceId: service._id.toString(),
    serviceName: service.name,
    homeId: booking.homeId?.toString(),
    assetId: booking.assetId?.toString(),
    addressSnapshot: booking.addressSnapshot,
    currentPricing,
    previousPricing: booking.serviceSnapshot.pricing,
    pricingChanged:
      JSON.stringify(currentPricing) !== JSON.stringify(booking.serviceSnapshot.pricing),
    availabilityNote: 'Provider availability must be revalidated at booking time.',
  };
}

export async function validateRebookingEligibility(customerId: string, bookingId: string) {
  const booking = await Booking.findOne({
    _id: bookingId,
    customerId,
    status: BookingStatus.COMPLETED,
  });
  return Boolean(booking);
}
