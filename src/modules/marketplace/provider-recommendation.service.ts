import { ErrorCode, ProviderRecommendationType } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ProviderProductRecommendation } from '@/models/Marketplace.js';
import { createRecommendationFromProvider } from '@/modules/marketplace/recommendation.service.js';
import { AppError } from '@/utils/AppError.js';

export async function createProviderRecommendation(
  providerId: string,
  input: {
    bookingId: string;
    recommendationType: ProviderRecommendationType;
    categoryId?: string;
    productId?: string;
    variantId?: string;
    sparePartId?: string;
    diagnosisSummary: string;
    reason: string;
    assetId?: string;
  },
) {
  const booking = await Booking.findOne({ _id: input.bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const rec = await ProviderProductRecommendation.create({
    providerId,
    bookingId: booking._id,
    customerId: booking.customerId,
    assetId: input.assetId ?? booking.assetId,
    recommendationType: input.recommendationType,
    categoryId: input.categoryId,
    productId: input.productId,
    variantId: input.variantId,
    sparePartId: input.sparePartId,
    diagnosisSummary: input.diagnosisSummary,
    reason: input.reason,
  });

  if (input.productId) {
    await createRecommendationFromProvider(rec._id.toString(), booking.customerId.toString());
  }

  return {
    id: rec._id.toString(),
    recommendationType: rec.recommendationType,
    diagnosisSummary: rec.diagnosisSummary,
    reason: rec.reason,
    productId: rec.productId?.toString(),
    variantId: rec.variantId?.toString(),
  };
}

export async function getProviderRecommendationsForBooking(providerId: string, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const recs = await ProviderProductRecommendation.find({ bookingId, providerId });
  return recs.map((r) => ({
    id: r._id.toString(),
    recommendationType: r.recommendationType,
    diagnosisSummary: r.diagnosisSummary,
    reason: r.reason,
    productId: r.productId?.toString(),
    variantId: r.variantId?.toString(),
  }));
}
