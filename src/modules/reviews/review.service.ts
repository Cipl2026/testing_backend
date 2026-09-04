import {
  BookingStatus,
  ErrorCode,
  ReviewCategory,
  ReviewStatus,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { Review } from '@/models/Review.js';
import { User } from '@/models/User.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { recalculateTrustMetrics } from '@/modules/trust/trust-metrics.service.js';
import { emitReviewCreated } from '@/modules/realtime/socket.service.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';

export async function createReview(
  customerId: string,
  bookingId: string,
  input: {
    rating: number;
    comment?: string;
    categories?: Array<{ category: ReviewCategory; rating: number }>;
  },
) {
  if (input.rating < 1 || input.rating > 5) {
    throw new AppError('Rating must be between 1 and 5.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new AppError('Only completed bookings can be reviewed.', 409, ErrorCode.CONFLICT);
  }

  const windowMs = env.review.windowDays * 24 * 60 * 60 * 1000;
  const completedAt = booking.updatedAt;
  if (Date.now() - completedAt.getTime() > windowMs) {
    throw new AppError('Review window has expired.', 409, ErrorCode.CONFLICT);
  }

  const existing = await Review.findOne({ bookingId });
  if (existing) return serializeReview(existing);

  const review = await Review.create({
    bookingId,
    customerId,
    providerId: booking.providerId,
    serviceId: booking.serviceId,
    rating: input.rating,
    comment: input.comment,
    categories: input.categories ?? [],
    status: ReviewStatus.PUBLISHED,
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.REVIEW_SUBMITTED,
    actorId: customerId,
    actorRole: UserRole.CUSTOMER,
    metadata: { rating: input.rating },
  });

  void recalculateTrustMetrics(booking.providerId.toString());
  emitReviewCreated(booking.providerId.toString(), serializeReview(review));

  return serializeReview(review);
}

export async function updateReview(
  customerId: string,
  reviewId: string,
  input: { rating?: number; comment?: string },
) {
  const review = await Review.findOne({ _id: reviewId, customerId });
  if (!review) throw new AppError('Review not found.', 404, ErrorCode.NOT_FOUND);

  const booking = await Booking.findById(review.bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const windowMs = env.review.windowDays * 24 * 60 * 60 * 1000;
  if (Date.now() - review.createdAt.getTime() > windowMs) {
    throw new AppError('Review edit window has expired.', 409, ErrorCode.CONFLICT);
  }

  if (input.rating !== undefined) {
    if (input.rating < 1 || input.rating > 5) {
      throw new AppError('Rating must be between 1 and 5.', 400, ErrorCode.VALIDATION_ERROR);
    }
    review.rating = input.rating;
  }
  if (input.comment !== undefined) review.comment = input.comment;
  await review.save();

  void recalculateTrustMetrics(review.providerId.toString());
  return serializeReview(review);
}

export async function listProviderReviews(providerId: string, query: { page: number; limit: number }) {
  const filter = { providerId, status: ReviewStatus.PUBLISHED };
  const total = await Review.countDocuments(filter);
  const items = await Review.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const customerIds = [...new Set(items.map((item) => item.customerId.toString()))];
  const customers = await User.find({ _id: { $in: customerIds } }).select('fullName');
  const customerNames = new Map(
    customers.map((customer) => [customer._id.toString(), customer.fullName ?? 'Customer']),
  );

  return {
    items: items.map((item) =>
      serializeReview(item, customerNames.get(item.customerId.toString())),
    ),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function moderateReview(
  adminId: string,
  reviewId: string,
  status: ReviewStatus,
  reason: string,
) {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError('Review not found.', 404, ErrorCode.NOT_FOUND);

  const before = review.status;
  review.status = status;
  await review.save();

  await AdminAuditLog.create({
    adminId,
    action: 'REVIEW_MODERATION',
    entityType: 'Review',
    entityId: review._id,
    reason,
    before: { status: before },
    after: { status },
  });

  void recalculateTrustMetrics(review.providerId.toString());
  return serializeReview(review);
}

export async function listAdminReviews(query: { page: number; limit: number; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const total = await Review.countDocuments(filter);
  const items = await Review.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map((doc) => serializeReview(doc)), total };
}

export async function getBookingsNeedingReviewReminder(): Promise<string[]> {
  const cutoff = new Date(Date.now() - env.review.reminderDelayHours * 60 * 60 * 1000);
  const bookings = await Booking.find({
    status: BookingStatus.COMPLETED,
    updatedAt: { $lte: cutoff },
  }).select('_id customerId');

  const ids: string[] = [];
  for (const b of bookings) {
    const hasReview = await Review.exists({ bookingId: b._id });
    if (!hasReview) ids.push(b._id.toString());
  }
  return ids;
}

function maskCustomerName(fullName?: string) {
  const trimmed = fullName?.trim();
  if (!trimmed) return 'Customer';
  const [first, ...rest] = trimmed.split(/\s+/);
  if (rest.length === 0) return first;
  return `${first} ${rest[0].charAt(0).toUpperCase()}.`;
}

function serializeReview(doc: InstanceType<typeof Review>, customerName?: string) {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    providerId: doc.providerId.toString(),
    serviceId: doc.serviceId.toString(),
    rating: doc.rating,
    comment: doc.comment,
    categories: doc.categories,
    status: doc.status,
    customerName: maskCustomerName(customerName),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
