import { DateTime } from 'luxon';
import {
  BookingContextType,
  OrganizationInvoiceStatus,
  OrganizationPermission,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { OrganizationInvoice } from '@/models/OrganizationOperations.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

function generateOrgInvoiceNumber(): string {
  return `ORG-${DateTime.now().toFormat('yyyyMMdd')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function generateConsolidatedInvoice(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await OrganizationInvoice.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  const existingPeriod = await OrganizationInvoice.findOne({
    organizationId,
    periodStart,
    periodEnd,
    status: { $ne: OrganizationInvoiceStatus.VOID },
  });
  if (existingPeriod) return existingPeriod;

  const bookings = await Booking.find({
    organizationId,
    bookingContextType: BookingContextType.ORGANIZATION,
    createdAt: { $gte: periodStart, $lte: periodEnd },
    status: 'COMPLETED',
  });

  const lineItems = bookings.map((b) => ({
    description: `Booking ${b.bookingNumber}`,
    bookingId: b._id,
    amount: b.price.finalAmount,
  }));

  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  return OrganizationInvoice.create({
    organizationId,
    invoiceNumber: generateOrgInvoiceNumber(),
    periodStart,
    periodEnd,
    status: OrganizationInvoiceStatus.OPEN,
    subtotal,
    tax,
    total,
    dueAt: DateTime.fromJSDate(periodEnd).plus({ days: 30 }).toJSDate(),
    lineItems,
    idempotencyKey,
  });
}

export async function listOrganizationInvoices(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_FINANCE);
  const invoices = await OrganizationInvoice.find({ organizationId }).sort({ periodStart: -1 });
  return invoices.map((i) => ({
    id: i._id.toString(),
    invoiceNumber: i.invoiceNumber,
    status: i.status,
    total: i.total,
    currency: i.currency,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    dueAt: i.dueAt,
    paidAt: i.paidAt,
  }));
}

export async function getOrganizationInvoice(userId: string, invoiceId: string) {
  const invoice = await OrganizationInvoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found.', 404, ErrorCode.NOT_FOUND);
  await assertOrganizationPermission(
    invoice.organizationId.toString(),
    userId,
    OrganizationPermission.VIEW_FINANCE,
  );
  return invoice;
}

export async function markOrganizationInvoicePaid(
  userId: string,
  invoiceId: string,
  paymentReference?: string,
) {
  const invoice = await OrganizationInvoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found.', 404, ErrorCode.NOT_FOUND);
  await assertOrganizationPermission(
    invoice.organizationId.toString(),
    userId,
    OrganizationPermission.MANAGE_BILLING,
  );

  invoice.status = OrganizationInvoiceStatus.PAID;
  invoice.paidAt = new Date();
  await invoice.save();

  await logOrganizationAudit({
    organizationId: invoice.organizationId.toString(),
    actorId: userId,
    action: 'INVOICE_PAID',
    resourceType: 'OrganizationInvoice',
    resourceId: invoiceId,
    after: { paymentReference },
  });

  return invoice;
}

export async function markOverdueInvoices() {
  const now = new Date();
  const result = await OrganizationInvoice.updateMany(
    {
      status: OrganizationInvoiceStatus.OPEN,
      dueAt: { $lt: now },
    },
    { status: OrganizationInvoiceStatus.OVERDUE },
  );
  return result.modifiedCount;
}
