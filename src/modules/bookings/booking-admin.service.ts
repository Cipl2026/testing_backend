import { Booking } from '@/models/Booking.js';
import { Payment } from '@/models/Payment.js';
import { listTimelineEvents } from '@/modules/bookings/timeline.service.js';
import { serializeBookingDetail, serializeBookingSummary } from '@/utils/bookingSerializers.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function adminListBookings(query: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { bookingNumber: { $regex: query.search, $options: 'i' } },
      { 'serviceSnapshot.name': { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await Booking.countDocuments(filter);
  const items = await Booking.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  return {
    items: items.map((booking) => serializeBookingSummary(booking)),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminGetBooking(bookingId: string) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  const timeline = await listTimelineEvents(bookingId);
  const payment = booking.payment.paymentId
    ? await Payment.findById(booking.payment.paymentId)
    : null;
  return serializeBookingDetail(booking, timeline, { payment });
}

export async function adminListPayments(query: { page: number; limit: number; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const total = await Payment.countDocuments(filter);
  const items = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return {
    items: items.map((p) => ({
      id: p._id.toString(),
      bookingId: p.bookingId.toString(),
      customerId: p.customerId.toString(),
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      createdAt: p.createdAt.toISOString(),
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}
