import * as bookingAdminService from '@/modules/bookings/booking-admin.service.js';
import * as bookingProviderService from '@/modules/bookings/booking-provider.service.js';
import * as bookingService from '@/modules/bookings/booking.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const createBooking = asyncHandler(async (req, res) => {
  const idempotencyKey = req.header('Idempotency-Key') ?? undefined;
  const booking = await bookingService.createBookingFromReservation(
    req.auth!.userId,
    req.body,
    idempotencyKey,
  );
  sendSuccess(res, 'Booking request sent successfully', booking, 201);
});

export const listBookings = asyncHandler(async (req, res) => {
  const result = await bookingService.listCustomerBookings(req.auth!.userId, req.query as never);
  sendSuccess(res, 'Bookings fetched successfully', { items: result.items }, 200, result.meta);
});

export const getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getCustomerBooking(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Booking fetched successfully', booking);
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelCustomerBooking(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.reason,
  );
  sendSuccess(res, 'Booking cancelled successfully', booking);
});

export const reportNoShow = asyncHandler(async (req, res) => {
  const result = await bookingService.redispatchAfterNoShow(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.reason,
  );
  sendSuccess(res, 'Provider did not arrive. Searching for another professional.', result);
});

export const respondReschedule = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.respondToReschedule(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.accept,
  );
  sendSuccess(res, 'Reschedule response recorded successfully', booking);
});

export const respondPriceChange = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.respondToPriceChange(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.accept,
  );
  sendSuccess(res, 'Price change response recorded successfully', booking);
});

export const listProviderBookings = asyncHandler(async (req, res) => {
  const result = await bookingProviderService.listProviderBookings(req.auth!.userId, req.query as never);
  sendSuccess(res, 'Bookings fetched successfully', { items: result.items }, 200, result.meta);
});

export const getProviderBooking = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.getProviderBooking(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Booking fetched successfully', booking);
});

export const acceptBooking = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.acceptBooking(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Booking accepted successfully', booking);
});

export const rejectBooking = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.rejectBooking(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.reason,
    req.body.category,
  );
  sendSuccess(res, 'Booking rejected successfully', booking);
});

export const cancelProviderBooking = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.cancelProviderBooking(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.reason,
  );
  sendSuccess(res, 'Booking cancelled successfully', booking);
});

export const enRoute = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.updateBookingStatusAction(
    req.auth!.userId,
    String(req.params.bookingId),
    'PROVIDER_EN_ROUTE',
  );
  sendSuccess(res, 'Status updated successfully', booking);
});

export const arrive = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.updateBookingStatusAction(
    req.auth!.userId,
    String(req.params.bookingId),
    'PROVIDER_ARRIVE',
  );
  sendSuccess(res, 'Status updated successfully', booking);
});

export const startService = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.updateBookingStatusAction(
    req.auth!.userId,
    String(req.params.bookingId),
    'START_SERVICE',
  );
  sendSuccess(res, 'Service started successfully', booking);
});

export const completeService = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.updateBookingStatusAction(
    req.auth!.userId,
    String(req.params.bookingId),
    'COMPLETE_SERVICE',
    { completionOtp: req.body.completionOtp },
  );
  sendSuccess(res, 'Service completed successfully', booking);
});

export const requestReschedule = asyncHandler(async (req, res) => {
  const booking = await bookingProviderService.requestReschedule(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.proposedStartDateTime,
    req.body.reason,
  );
  sendSuccess(res, 'Reschedule request sent successfully', booking);
});

export const requestPriceChange = asyncHandler(async (req, res) => {
  const record = await bookingProviderService.requestPriceChange(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body.proposedAmount,
    req.body.reason,
    req.body.items,
  );
  sendSuccess(res, 'Price change request sent successfully', record, 201);
});

export const adminListBookings = asyncHandler(async (req, res) => {
  const result = await bookingAdminService.adminListBookings(req.query as never);
  sendSuccess(res, 'Bookings fetched successfully', { items: result.items }, 200, result.meta);
});

export const adminGetBooking = asyncHandler(async (req, res) => {
  const booking = await bookingAdminService.adminGetBooking(String(req.params.bookingId));
  sendSuccess(res, 'Booking fetched successfully', booking);
});

export const adminListPayments = asyncHandler(async (req, res) => {
  const result = await bookingAdminService.adminListPayments(req.query as never);
  sendSuccess(res, 'Payments fetched successfully', { items: result.items }, 200, result.meta);
});
