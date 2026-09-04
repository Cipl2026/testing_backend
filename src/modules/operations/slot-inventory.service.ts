import { ProviderSlotInventory } from '@/models/ProviderSlotInventory.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { isRedisEnabled } from '@/infra/redis.js';

export async function reserveSlotInventory(input: {
  providerId: string;
  serviceId: string;
  slotStart: Date;
  date: string;
  serviceZoneId?: string;
}): Promise<boolean> {
  if (!isRedisEnabled()) return true;

  const inventory = await ProviderSlotInventory.findOne({
    providerId: input.providerId,
    serviceId: input.serviceId,
    slotStart: input.slotStart,
  });

  if (!inventory) return true;

  const updated = await ProviderSlotInventory.findOneAndUpdate(
    {
      _id: inventory._id,
      reserved: { $lt: inventory.capacity },
    },
    { $inc: { reserved: 1 } },
    { new: true },
  );

  if (!updated) {
    throw new AppError('Slot inventory is full for this time.', 409, ErrorCode.CONFLICT);
  }
  return true;
}

export async function releaseSlotInventory(input: {
  providerId: string;
  serviceId: string;
  slotStart: Date;
}): Promise<void> {
  await ProviderSlotInventory.findOneAndUpdate(
    {
      providerId: input.providerId,
      serviceId: input.serviceId,
      slotStart: input.slotStart,
      reserved: { $gt: 0 },
    },
    { $inc: { reserved: -1 } },
  );
}

export async function upsertSlotInventory(input: {
  providerId: string;
  serviceId: string;
  date: string;
  slotStart: Date;
  capacity: number;
  serviceZoneId?: string;
}) {
  const row = await ProviderSlotInventory.findOneAndUpdate(
    {
      providerId: input.providerId,
      serviceId: input.serviceId,
      slotStart: input.slotStart,
    },
    {
      $set: {
        date: input.date,
        capacity: input.capacity,
        serviceZoneId: input.serviceZoneId,
      },
      $setOnInsert: { reserved: 0 },
    },
    { upsert: true, new: true },
  );
  return {
    id: row._id.toString(),
    capacity: row.capacity,
    reserved: row.reserved,
  };
}
