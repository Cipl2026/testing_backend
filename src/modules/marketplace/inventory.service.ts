import { ErrorCode, InventoryStatus, MarketplacePartnerStatus } from '@ghaarfix/shared-types';
import {
  Inventory,
  InventoryReservation,
  MarketplacePartner,
} from '@/models/Marketplace.js';
import { AppError } from '@/utils/AppError.js';

const RESERVATION_MINUTES = 15;

function availableQty(inv: InstanceType<typeof Inventory>) {
  return Math.max(0, inv.availableQuantity - inv.reservedQuantity);
}

export async function reserveInventory(input: {
  customerId: string;
  variantId: string;
  partnerId: string;
  quantity: number;
  serviceZoneId?: string;
}) {
  const partner = await MarketplacePartner.findById(input.partnerId);
  if (!partner || partner.status !== MarketplacePartnerStatus.ACTIVE) {
    throw new AppError('Partner not available for sales.', 403, ErrorCode.FORBIDDEN);
  }

  const filter: Record<string, unknown> = {
    variantId: input.variantId,
    partnerId: input.partnerId,
  };
  if (input.serviceZoneId) filter.serviceZoneId = input.serviceZoneId;

  const updated = await Inventory.findOneAndUpdate(
    {
      ...filter,
      $expr: {
        $gte: [{ $subtract: ['$availableQuantity', '$reservedQuantity'] }, input.quantity],
      },
    },
    { $inc: { reservedQuantity: input.quantity } },
    { new: true },
  );

  if (!updated) {
    throw new AppError('Insufficient inventory.', 409, ErrorCode.CONFLICT);
  }

  if (availableQty(updated) <= updated.reorderLevel) {
    updated.status = InventoryStatus.LOW_STOCK;
    await updated.save();
  }

  const reservation = await InventoryReservation.create({
    variantId: input.variantId,
    partnerId: input.partnerId,
    customerId: input.customerId,
    quantity: input.quantity,
    expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
    status: 'ACTIVE',
  });

  return reservation;
}

export async function confirmReservation(reservationId: string, orderId: string) {
  const reservation = await InventoryReservation.findById(reservationId);
  if (!reservation || reservation.status !== 'ACTIVE') {
    throw new AppError('Reservation invalid.', 409, ErrorCode.CONFLICT);
  }

  await Inventory.findOneAndUpdate(
    {
      variantId: reservation.variantId,
      partnerId: reservation.partnerId,
      reservedQuantity: { $gte: reservation.quantity },
    },
    {
      $inc: {
        reservedQuantity: -reservation.quantity,
        availableQuantity: -reservation.quantity,
      },
    },
  );

  reservation.status = 'CONFIRMED';
  reservation.orderId = orderId as unknown as import('mongoose').Types.ObjectId;
  await reservation.save();
}

export async function releaseReservation(reservationId: string) {
  const reservation = await InventoryReservation.findById(reservationId);
  if (!reservation || reservation.status !== 'ACTIVE') return;

  await Inventory.findOneAndUpdate(
    {
      variantId: reservation.variantId,
      partnerId: reservation.partnerId,
      reservedQuantity: { $gte: reservation.quantity },
    },
    { $inc: { reservedQuantity: -reservation.quantity } },
  );

  reservation.status = 'RELEASED';
  await reservation.save();
}

export async function expireStaleReservations() {
  const expired = await InventoryReservation.find({
    status: 'ACTIVE',
    expiresAt: { $lt: new Date() },
  }).limit(100);

  for (const r of expired) {
    await releaseReservation(r._id.toString());
    r.status = 'EXPIRED';
    await r.save();
  }
  return expired.length;
}

export async function upsertInventory(
  partnerId: string,
  input: {
    variantId: string;
    serviceZoneId?: string;
    availableQuantity: number;
    reorderLevel?: number;
  },
) {
  const inv = await Inventory.findOneAndUpdate(
    {
      variantId: input.variantId,
      partnerId,
      serviceZoneId: input.serviceZoneId ?? { $exists: false },
    },
    {
      availableQuantity: input.availableQuantity,
      reorderLevel: input.reorderLevel ?? 5,
      status:
        input.availableQuantity === 0
          ? InventoryStatus.OUT_OF_STOCK
          : input.availableQuantity <= (input.reorderLevel ?? 5)
            ? InventoryStatus.LOW_STOCK
            : InventoryStatus.IN_STOCK,
    },
    { upsert: true, new: true },
  );
  return inv;
}
