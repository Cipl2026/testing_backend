import {
  BookingContextType,
  BookingSource,
  BookingStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
} from '@ghaarfix/shared-types';
import { calculateJobPricing, calculateUrgentSurcharge } from '@ghaarfix/shared-types';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { Booking } from '@/models/Booking.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { Invoice } from '@/models/Invoice.js';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { User } from '@/models/User.js';
import { generateInvoiceForBooking } from '@/modules/invoices/invoice.service.js';
import { generateBookingNumber } from '@/utils/bookingNumber.js';
import { logger } from '@/utils/logger.js';

const DEFAULT_CUSTOMER_PHONE = '+919876543210';
const TARGET_INVOICE_COUNT = 3;

function normalizePhoneE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (input.startsWith('+')) return input;
  return `+${digits}`;
}

function resolveSeedPhone(): string {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env.SEED_PHONE?.trim();
  const raw = fromArg || fromEnv || DEFAULT_CUSTOMER_PHONE.replace('+91', '');
  return normalizePhoneE164(raw);
}

const DEMO_BOOKINGS = [
  { serviceSlug: 'split-ac-service', daysAgo: 5, amount: 899, urgent: false },
  { serviceSlug: 'tap-repair', daysAgo: 12, amount: 399, urgent: false },
  { serviceSlug: 'fan-repair', daysAgo: 24, amount: 449, urgent: false },
  { serviceSlug: 'pipe-leakage-repair', daysAgo: 38, amount: 599, urgent: true, visitCharge: 200 },
] as const;

function buildPrice(amount: number, urgent: boolean, visitCharge = 0) {
  const urgentSurcharge = urgent ? calculateUrgentSurcharge(visitCharge) : 0;
  const priced = calculateJobPricing({ serviceAmount: amount, urgentSurcharge });
  return {
    estimatedAmount: amount,
    baseAmount: amount,
    finalAmount: priced.finalAmount,
    customerJobSubtotal: priced.customerJobSubtotal,
    jobSubtotal: priced.jobSubtotal,
    platformFeeAmount: priced.platformFee,
    urgentSurcharge: priced.urgentSurcharge,
    providerPayoutAmount: priced.providerPayoutAmount,
    visitCharge: priced.urgentSurcharge,
    currency: 'INR' as const,
  };
}

async function ensureDemoCompletedBookings(customerId: string, customerPhone: string): Promise<string[]> {
  const customer = await User.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  const address = await CustomerAddress.findOne({ customerId, isDefault: true });
  const addressSnapshot = address
    ? {
        recipientName: address.recipientName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        location: address.location
          ? {
              latitude: address.location.coordinates[1],
              longitude: address.location.coordinates[0],
            }
          : undefined,
      }
    : {
        recipientName: customer.fullName ?? 'Customer',
        phone: customerPhone,
        addressLine1: '12 Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001',
      };

  const createdBookingIds: string[] = [];

  for (const seed of DEMO_BOOKINGS) {
    const service = await Service.findOne({ slug: seed.serviceSlug, isActive: true });
    if (!service) {
      logger.warn('Skipping invoice seed — service not found', { slug: seed.serviceSlug });
      continue;
    }

    const providerService = await ProviderService.findOne({
      serviceId: service._id,
      isActive: true,
    }).sort({ updatedAt: -1 });
    if (!providerService) {
      logger.warn('Skipping invoice seed — provider service not found', { slug: seed.serviceSlug });
      continue;
    }

    const provider = await User.findById(providerService.providerId);
    if (!provider) {
      logger.warn('Skipping invoice seed — provider user not found', { slug: seed.serviceSlug });
      continue;
    }

    const providerName = provider.fullName ?? 'Ghaarfix Professional';

    const existing = await Booking.findOne({
      customerId,
      serviceId: service._id,
      status: BookingStatus.COMPLETED,
    });
    if (existing) {
      createdBookingIds.push(existing._id.toString());
      continue;
    }

    const scheduledStart = new Date(Date.now() - seed.daysAgo * 86_400_000);
    scheduledStart.setHours(11, 0, 0, 0);
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60_000);

    const durationMinutes =
      typeof service.estimatedDuration === 'number'
        ? service.estimatedDuration
        : service.estimatedDuration?.minMinutes ?? 60;

    const booking = await Booking.create({
      bookingNumber: await generateBookingNumber(),
      bookingType: seed.urgent ? BookingType.URGENT : BookingType.SCHEDULED,
      source: seed.urgent ? BookingSource.URGENT_FIX : BookingSource.SLOT_RESERVATION,
      customerId,
      providerId: provider._id,
      serviceId: service._id,
      providerServiceId: providerService._id,
      bookingContextType: BookingContextType.PERSONAL,
      addressSnapshot,
      serviceSnapshot: {
        name: service.name,
        shortDescription: service.shortDescription,
        pricing: {
          type: service.pricing?.type ?? 'FIXED',
          startingPrice: service.pricing?.startingPrice,
          currency: service.pricing?.currency ?? 'INR',
        },
      },
      providerSnapshot: {
        fullName: providerName,
        profileImage: provider.profileImage,
      },
      status: BookingStatus.COMPLETED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart,
      scheduledEnd,
      timezone: 'Asia/Kolkata',
      durationMinutes,
      price: buildPrice(seed.amount, seed.urgent, seed.urgent ? seed.visitCharge ?? 0 : 0),
      payment: {
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PAID,
      },
      tracking: {
        completionConfirmedAt: scheduledEnd,
      },
    });

    createdBookingIds.push(booking._id.toString());
    logger.info('Created demo completed booking', {
      bookingNumber: booking.bookingNumber,
      service: service.name,
    });
  }

  return createdBookingIds;
}

async function backfillInvoicesForAllCustomers(): Promise<number> {
  const completedBookings = await Booking.find({ status: BookingStatus.COMPLETED }).select('_id');
  let generated = 0;
  for (const booking of completedBookings) {
    const bookingId = booking._id.toString();
    const hasInvoice = await Invoice.exists({ bookingId });
    if (hasInvoice) continue;
    try {
      await generateInvoiceForBooking(bookingId);
      generated += 1;
    } catch (err) {
      logger.warn('Invoice backfill skipped', { bookingId, err });
    }
  }
  return generated;
}

async function seedInvoicesForCustomer(customerPhone: string): Promise<void> {
  const customer = await User.findOne({ phone: customerPhone });
  if (!customer) {
    throw new Error(
      `Customer ${customerPhone} not found. Register in the app first, then run: npm run seed:invoices -- <phone>`,
    );
  }

  const bookingIds = await ensureDemoCompletedBookings(customer._id.toString(), customerPhone);

  const completedBookings = await Booking.find({
    customerId: customer._id,
    status: BookingStatus.COMPLETED,
  }).sort({ scheduledStart: -1 });

  const allBookingIds = [
    ...new Set([
      ...bookingIds,
      ...completedBookings.map((b) => b._id.toString()),
    ]),
  ];

  let generated = 0;
  for (const bookingId of allBookingIds) {
    const hasInvoice = await Invoice.exists({ bookingId });
    if (hasInvoice) continue;
    await generateInvoiceForBooking(bookingId);
    generated += 1;
  }

  const backfilled = await backfillInvoicesForAllCustomers();

  const total = await Invoice.countDocuments({ customerId: customer._id });
  if (total < TARGET_INVOICE_COUNT) {
    logger.warn('Fewer invoices than target', { total, target: TARGET_INVOICE_COUNT });
  }

  const invoices = await Invoice.find({ customerId: customer._id })
    .sort({ issuedAt: -1 })
    .limit(10);

  const summary = {
    customerPhone,
    customerName: customer.fullName,
    newlyGenerated: generated,
    backfilledAllCustomers: backfilled,
    totalInvoices: total,
    invoices: invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      service: inv.snapshot.serviceName,
      total: inv.total,
      bookingId: inv.bookingId.toString(),
    })),
  };

  logger.info('Invoice seed completed', summary);
  console.log('✓ Invoice seed completed');
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  if (env.isProd) {
    throw new Error('Invoice seed cannot run in production.');
  }
  const customerPhone = resolveSeedPhone();
  await connectDatabase();
  await seedInvoicesForCustomer(customerPhone);
  await disconnectDatabase();
}

if (process.argv[1]?.endsWith('seed-invoices.ts') || process.argv[1]?.endsWith('seed-invoices.js')) {
  main().catch(async (error) => {
    console.error('Invoice seed failed:', error);
    await disconnectDatabase();
    process.exit(1);
  });
}
