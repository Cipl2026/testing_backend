import { OrganizationPermission } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { OrganizationInvoice } from '@/models/OrganizationOperations.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { listOrganizationInvoices } from '@/modules/organizations/organization-billing.service.js';
import { toMinor } from '@/utils/money.js';

export async function getOrganizationFinance(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_FINANCE);

  const [invoices, bookings] = await Promise.all([
    OrganizationInvoice.find({ organizationId }).sort({ periodStart: -1 }).limit(12),
    Booking.find({ organizationId, status: 'COMPLETED' })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('bookingNumber price updatedAt serviceSnapshot'),
  ]);

  const totalSpendMinor = bookings.reduce((s, b) => s + toMinor(b.price?.finalAmount ?? 0), 0);
  const openInvoices = invoices.filter((i) => i.status === 'OPEN' || i.status === 'OVERDUE');

  return {
    organizationId,
    totalSpendMinor,
    openInvoiceCount: openInvoices.length,
    recentBookings: bookings.map((b) => ({
      id: b._id.toString(),
      bookingNumber: b.bookingNumber,
      serviceName: b.serviceSnapshot?.name,
      amountMinor: toMinor(b.price?.finalAmount ?? 0),
      completedAt: b.updatedAt,
    })),
    invoices: await listOrganizationInvoices(userId, organizationId),
  };
}
