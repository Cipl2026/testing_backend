import mongoose from 'mongoose';
import {
  BookingStatus,
  BookingType,
  ErrorCode,
  InvoiceStatus,
  PaymentStatus,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Invoice, type InvoiceLineItem } from '@/models/Invoice.js';
import {
  generateInvoicePdf,
  INVOICE_PDF_TEMPLATE_VERSION,
} from '@/modules/invoices/invoice-pdf.service.js';
import { calculateTax } from '@/modules/tax/tax.service.js';
import { storePdf } from '@/modules/storage/storage.service.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { notifyBookingEvent } from '@/modules/notifications/notification.service.js';
import { emitInvoiceReady } from '@/modules/realtime/socket.service.js';
import { generateInvoiceNumber } from '@/utils/invoiceNumber.js';
import { AppError } from '@/utils/AppError.js';
import { logger } from '@/utils/logger.js';

const pendingPdfJobs = new Set<string>();

export function scheduleInvoiceGeneration(bookingId: string): void {
  if (pendingPdfJobs.has(bookingId)) return;
  pendingPdfJobs.add(bookingId);
  void generateInvoiceForBooking(bookingId)
    .catch((err) => logger.error('Invoice generation failed', { bookingId, err }))
    .finally(() => pendingPdfJobs.delete(bookingId));
}

export async function generateInvoiceForBooking(bookingId: string) {
  const existing = await Invoice.findOne({ bookingId });
  if (existing?.pdfUrl) return serializeInvoice(existing);

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new AppError('Invoice can only be generated for completed bookings.', 409, ErrorCode.CONFLICT);
  }

  if (existing) {
    await generateAndAttachPdf(existing);
    return serializeInvoice(existing);
  }

  const serviceAmount = Math.max(
    0,
    (booking.price.customerJobSubtotal ?? booking.price.finalAmount) -
      (booking.price.urgentSurcharge ?? 0),
  );
  const urgentFee =
    booking.price.urgentSurcharge ??
    (booking.bookingType === BookingType.URGENT ? Math.max(0, booking.price.visitCharge ?? 0) : 0);
  const platformFee = booking.price.platformFeeAmount ?? 0;
  const customerTotal = booking.price.finalAmount;

  const lineItems: InvoiceLineItem[] = [
    {
      description: booking.serviceSnapshot.name,
      quantity: 1,
      unitAmount: serviceAmount,
      amount: serviceAmount,
    },
  ];
  if (urgentFee > 0) {
    lineItems.push({
      description: 'Urgent service fee',
      quantity: 1,
      unitAmount: urgentFee,
      amount: urgentFee,
    });
  }
  if (platformFee > 0) {
    lineItems.push({
      description: 'Platform fee',
      quantity: 1,
      unitAmount: platformFee,
      amount: platformFee,
    });
  }

  const subtotal = customerTotal - platformFee;
  const taxCalc = calculateTax(customerTotal);

  const invoice = await Invoice.create({
    invoiceNumber: generateInvoiceNumber(),
    bookingId,
    customerId: booking.customerId,
    providerId: booking.providerId,
    status: InvoiceStatus.ISSUED,
    currency: booking.price.currency,
    lineItems,
    subtotal,
    urgentFee,
    discount: 0,
    tax: taxCalc.taxAmount,
    total: taxCalc.total,
    paymentStatus: booking.payment.status,
    snapshot: {
      customerName: booking.addressSnapshot.recipientName,
      customerPhone: booking.addressSnapshot.phone,
      providerName: booking.providerSnapshot.fullName,
      serviceName: booking.serviceSnapshot.name,
      bookingNumber: booking.bookingNumber,
      serviceDate: booking.scheduledStart,
      addressSummary: `${booking.addressSnapshot.addressLine1}, ${booking.addressSnapshot.city}`,
    },
    issuedAt: new Date(),
    paidAt: booking.payment.status === PaymentStatus.PAID ? new Date() : undefined,
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.INVOICE_ISSUED,
    actorId: booking.providerId.toString(),
    actorRole: UserRole.PROVIDER,
  });

  await generateAndAttachPdf(invoice);

  await notifyBookingEvent(
    booking.customerId.toString(),
    'INVOICE_READY',
    'Invoice ready',
    'Your service invoice is ready to view.',
    bookingId,
  );

  emitInvoiceReady(booking.customerId.toString(), {
    bookingId,
    invoiceId: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
  });

  return serializeInvoice(invoice);
}

async function generateAndAttachPdf(invoice: InstanceType<typeof Invoice>) {
  const needsRegeneration =
    !invoice.pdfUrl ||
    (invoice.pdfTemplateVersion ?? 1) < INVOICE_PDF_TEMPLATE_VERSION;
  if (!needsRegeneration) return;

  const pdfBuffer = await generateInvoicePdf(invoice);
  const stored = await storePdf(pdfBuffer, `invoices/${invoice.bookingId}`);
  invoice.pdfUrl = stored.fileUrl;
  invoice.pdfKey = stored.fileKey;
  invoice.pdfGeneratedAt = new Date();
  invoice.pdfTemplateVersion = INVOICE_PDF_TEMPLATE_VERSION;
  await invoice.save();
}

export async function getBookingInvoice(userId: string, bookingId: string, role: string) {
  const filter: Record<string, unknown> = { _id: bookingId };
  if (role === 'CUSTOMER') filter.customerId = userId;
  if (role === 'PROVIDER') filter.providerId = userId;

  const booking = await Booking.findOne(filter);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  let invoice = await Invoice.findOne({ bookingId });
  if (!invoice && booking.status === BookingStatus.COMPLETED) {
    invoice = await Invoice.findOne({ bookingId });
    if (!invoice) {
      return generateInvoiceForBooking(bookingId);
    }
  }
  if (!invoice) throw new AppError('Invoice not available yet.', 404, ErrorCode.NOT_FOUND);
  return serializeInvoice(invoice);
}

export async function getInvoiceById(userId: string, invoiceId: string, role: string) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found.', 404, ErrorCode.NOT_FOUND);

  if (role === 'CUSTOMER' && invoice.customerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }
  if (role === 'PROVIDER' && invoice.providerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }

  return serializeInvoice(invoice);
}

export async function getInvoicePdfKey(invoiceId: string, userId: string, role: string) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found.', 404, ErrorCode.NOT_FOUND);

  if (role === 'CUSTOMER' && invoice.customerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }
  if (role === 'PROVIDER' && invoice.providerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }
  await generateAndAttachPdf(invoice);
  return invoice.pdfKey!;
}

export async function listAdminInvoices(query: { page: number; limit: number }) {
  const total = await Invoice.countDocuments();
  const items = await Invoice.find()
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map(serializeInvoice), total };
}

export async function syncMissingCustomerInvoices(customerId: string): Promise<void> {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);
  const completedBookings = await Booking.find({
    customerId: customerObjectId,
    status: BookingStatus.COMPLETED,
  })
    .select('_id')
    .lean();

  if (completedBookings.length === 0) return;

  const bookingIds = completedBookings.map((b) => b._id);
  const existing = await Invoice.find({ bookingId: { $in: bookingIds } }).select('bookingId').lean();
  const existingIds = new Set(existing.map((inv) => inv.bookingId.toString()));

  for (const booking of completedBookings) {
    const bookingId = booking._id.toString();
    if (existingIds.has(bookingId)) continue;
    try {
      await generateInvoiceForBooking(bookingId);
    } catch (err) {
      logger.warn('Invoice backfill failed', { bookingId, err });
    }
  }
}

export async function listCustomerInvoices(customerId: string, query: { page: number; limit: number }) {
  await syncMissingCustomerInvoices(customerId);
  const filter = { customerId: new mongoose.Types.ObjectId(customerId) };
  const total = await Invoice.countDocuments(filter);
  const items = await Invoice.find(filter)
    .sort({ issuedAt: -1, createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  return { items: items.map(serializeInvoice), total };
}

function serializeInvoice(doc: InstanceType<typeof Invoice>) {
  return {
    id: doc._id.toString(),
    invoiceNumber: doc.invoiceNumber,
    bookingId: doc.bookingId.toString(),
    status: doc.status,
    currency: doc.currency,
    lineItems: doc.lineItems,
    subtotal: doc.subtotal,
    urgentFee: doc.urgentFee,
    discount: doc.discount,
    tax: doc.tax,
    total: doc.total,
    paymentStatus: doc.paymentStatus,
    snapshot: {
      ...doc.snapshot,
      serviceDate: doc.snapshot.serviceDate.toISOString(),
    },
    pdfUrl: doc.pdfUrl,
    issuedAt: doc.issuedAt?.toISOString(),
    paidAt: doc.paidAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function processPendingInvoicePdfs(): Promise<number> {
  const pending = await Invoice.find({ pdfUrl: { $exists: false } }).limit(20);
  let count = 0;
  for (const inv of pending) {
    try {
      await generateAndAttachPdf(inv);
      count += 1;
    } catch (err) {
      logger.error('PDF job failed', { invoiceId: inv._id, err });
    }
  }
  return count;
}
