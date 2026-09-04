import * as completionService from '@/modules/completion/completion.service.js';
import * as evidenceService from '@/modules/evidence/evidence.service.js';
import * as invoiceService from '@/modules/invoices/invoice.service.js';
import * as reviewService from '@/modules/reviews/review.service.js';
import * as supportService from '@/modules/support/support.service.js';
import * as trustService from '@/modules/trust/trust-metrics.service.js';
import {
  calculateBookingEta,
  getCustomerTracking,
  updateProviderBookingLocation,
} from '@/modules/tracking/location-tracking.service.js';
import { readStoredFile } from '@/modules/storage/storage.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

// Tracking
export const postProviderLocation = asyncHandler(async (req, res) => {
  const data = await updateProviderBookingLocation(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Location updated successfully', data);
});

export const getBookingTracking = asyncHandler(async (req, res) => {
  const data = await getCustomerTracking(req.auth!.userId, String(req.params.bookingId));
  sendSuccess(res, 'Tracking fetched successfully', data);
});

export const getBookingEta = asyncHandler(async (req, res) => {
  const data = await calculateBookingEta(req.auth!.userId, String(req.params.bookingId));
  sendSuccess(res, 'ETA fetched successfully', data);
});

// Evidence
export const uploadEvidence = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'File required', data: null });
    return;
  }
  const data = await evidenceService.uploadServiceEvidence(
    req.auth!.userId,
    String(req.params.bookingId),
    {
      type: req.body.type,
      buffer: file.buffer,
      mimeType: file.mimetype,
      caption: req.body.caption,
      capturedAt: req.body.capturedAt,
    },
  );
  sendSuccess(res, 'Evidence uploaded successfully', data, 201);
});

export const getBookingEvidence = asyncHandler(async (req, res) => {
  const role = req.auth!.role === 'ADMIN' ? 'ADMIN' : req.auth!.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
  const data = await evidenceService.listBookingEvidence(
    req.auth!.userId,
    String(req.params.bookingId),
    role,
  );
  sendSuccess(res, 'Evidence fetched successfully', { items: data });
});

// Completion
export const submitCompletionSummary = asyncHandler(async (req, res) => {
  const data = await completionService.submitCompletionSummary(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Completion summary saved successfully', data, 201);
});

export const getCompletionSummary = asyncHandler(async (req, res) => {
  const role = req.auth!.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
  const data = await completionService.getCompletionSummary(
    req.auth!.userId,
    String(req.params.bookingId),
    role,
  );
  sendSuccess(res, 'Completion summary fetched successfully', data);
});

export const confirmCompletion = asyncHandler(async (req, res) => {
  const data = await completionService.confirmCompletion(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Completion confirmed successfully', data);
});

// Invoice
export const getBookingInvoice = asyncHandler(async (req, res) => {
  const role = req.auth!.role ?? 'CUSTOMER';
  const data = await invoiceService.getBookingInvoice(
    req.auth!.userId,
    String(req.params.bookingId),
    role,
  );
  sendSuccess(res, 'Invoice fetched successfully', data);
});

export const getInvoice = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoiceById(
    req.auth!.userId,
    String(req.params.invoiceId),
    req.auth!.role ?? 'CUSTOMER',
  );
  sendSuccess(res, 'Invoice fetched successfully', data);
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  const fileKey = await invoiceService.getInvoicePdfKey(
    String(req.params.invoiceId),
    req.auth!.userId,
    req.auth!.role ?? 'CUSTOMER',
  );
  const { buffer, mimeType } = await readStoredFile(fileKey);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="invoice.pdf"`);
  res.send(buffer);
});

export const listCustomerInvoices = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await invoiceService.listCustomerInvoices(req.auth!.userId, { page, limit });
  sendSuccess(
    res,
    'Invoices fetched successfully',
    { items: result.items },
    200,
    { page, limit, total: result.total },
  );
});

// Reviews
export const createReview = asyncHandler(async (req, res) => {
  const data = await reviewService.createReview(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Review submitted successfully', data, 201);
});

export const updateReview = asyncHandler(async (req, res) => {
  const data = await reviewService.updateReview(
    req.auth!.userId,
    String(req.params.reviewId),
    req.body,
  );
  sendSuccess(res, 'Review updated successfully', data);
});

export const listProviderReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listProviderReviews(
    String(req.params.providerId),
    req.query as never,
  );
  sendSuccess(res, 'Reviews fetched successfully', { items: result.items }, 200, result.meta);
});

// Support
export const createSupportTicket = asyncHandler(async (req, res) => {
  const data = await supportService.createSupportTicket(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Support ticket created successfully', data, 201);
});

export const listSupportTickets = asyncHandler(async (req, res) => {
  const result = await supportService.listCustomerTickets(req.auth!.userId, req.query as never);
  sendSuccess(res, 'Support tickets fetched successfully', { items: result.items }, 200, result.meta);
});

export const getSupportTicket = asyncHandler(async (req, res) => {
  const data = await supportService.getCustomerTicket(
    req.auth!.userId,
    String(req.params.ticketId),
  );
  sendSuccess(res, 'Support ticket fetched successfully', data);
});

export const getOrCreateSupportChat = asyncHandler(async (req, res) => {
  const data = await supportService.getOrCreateGeneralSupportTicket(req.auth!.userId);
  sendSuccess(res, 'Support chat ready', data);
});

export const createGeneralSupportTicket = asyncHandler(async (req, res) => {
  const data = await supportService.createGeneralSupportTicket(req.auth!.userId, req.body);
  sendSuccess(res, 'Support ticket created successfully', data, 201);
});

export const addSupportMessage = asyncHandler(async (req, res) => {
  const data = await supportService.addCustomerMessage(
    req.auth!.userId,
    String(req.params.ticketId),
    req.body.body,
  );
  sendSuccess(res, 'Message sent successfully', data);
});

// Trust
export const getProviderTrust = asyncHandler(async (req, res) => {
  const data = await trustService.getProviderTrustMetrics(String(req.params.providerId));
  sendSuccess(res, 'Trust metrics fetched successfully', data);
});

// Admin
export const adminListInvoices = asyncHandler(async (req, res) => {
  const result = await invoiceService.listAdminInvoices(req.query as never);
  sendSuccess(res, 'Invoices fetched successfully', { items: result.items, total: result.total });
});

export const adminListReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.listAdminReviews(req.query as never);
  sendSuccess(res, 'Reviews fetched successfully', { items: result.items, total: result.total });
});

export const adminModerateReview = asyncHandler(async (req, res) => {
  const data = await reviewService.moderateReview(
    req.auth!.userId,
    String(req.params.reviewId),
    req.body.status,
    req.body.reason,
  );
  sendSuccess(res, 'Review moderated successfully', data);
});

export const adminListSupportTickets = asyncHandler(async (req, res) => {
  const result = await supportService.listAdminTickets(req.query as never);
  sendSuccess(res, 'Support tickets fetched successfully', { items: result.items, total: result.total });
});

export const adminGetSupportTicket = asyncHandler(async (req, res) => {
  const data = await supportService.getAdminTicket(String(req.params.ticketId));
  sendSuccess(res, 'Support ticket fetched successfully', data);
});

export const adminUpdateSupportTicket = asyncHandler(async (req, res) => {
  const data = await supportService.updateAdminTicket(
    req.auth!.userId,
    String(req.params.ticketId),
    req.body,
  );
  sendSuccess(res, 'Support ticket updated successfully', data);
});

// Files
export const serveFile = asyncHandler(async (req, res) => {
  const fileKey = String(req.params.fileKey);
  const { buffer, mimeType } = await readStoredFile(fileKey);
  res.setHeader('Content-Type', mimeType);
  res.send(buffer);
});
