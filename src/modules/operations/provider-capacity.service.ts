import { DateTime } from 'luxon';
import { ProviderCapacityStatus } from '@ghaarfix/shared-types';
import { ProviderCapacity } from '@/models/ProviderCapacity.js';
import { ProviderPresence } from '@/models/ProviderPresence.js';

const DEFAULT_MAX_DAILY = 8;
const LIMITED_THRESHOLD = 0.75;

function computeStatus(booked: number, max: number): ProviderCapacityStatus {
  if (booked >= max) return ProviderCapacityStatus.FULL;
  if (booked / max >= LIMITED_THRESHOLD) return ProviderCapacityStatus.LIMITED;
  return ProviderCapacityStatus.AVAILABLE;
}

export async function getOrCreateProviderCapacity(providerId: string, date?: string) {
  const day = date ?? DateTime.now().setZone('Asia/Kolkata').toISODate()!;
  let row = await ProviderCapacity.findOne({ providerId, date: day });
  if (!row) {
    row = await ProviderCapacity.create({
      providerId,
      date: day,
      bookedCount: 0,
      maxDailyJobs: DEFAULT_MAX_DAILY,
      status: ProviderCapacityStatus.AVAILABLE,
      lastUpdatedAt: new Date(),
    });
  }
  return row;
}

export async function getProviderCapacityStatus(providerId: string): Promise<ProviderCapacityStatus> {
  const presence = await ProviderPresence.findOne({ providerId });
  if (!presence?.isOnline) return ProviderCapacityStatus.OFFLINE;

  const row = await getOrCreateProviderCapacity(providerId);
  return row.status;
}

export async function incrementProviderBookedCount(providerId: string, date?: string) {
  const day = date ?? DateTime.now().setZone('Asia/Kolkata').toISODate()!;
  const row = await getOrCreateProviderCapacity(providerId, day);
  row.bookedCount += 1;
  row.status = computeStatus(row.bookedCount, row.maxDailyJobs);
  row.lastUpdatedAt = new Date();
  await row.save();
  return row;
}

export async function updateProviderCapacity(
  providerId: string,
  input: { maxDailyJobs?: number; status?: ProviderCapacityStatus },
  date?: string,
) {
  const row = await getOrCreateProviderCapacity(providerId, date);
  if (input.maxDailyJobs !== undefined) row.maxDailyJobs = input.maxDailyJobs;
  if (input.status !== undefined) {
    row.status = input.status;
  } else {
    row.status = computeStatus(row.bookedCount, row.maxDailyJobs);
  }
  row.lastUpdatedAt = new Date();
  await row.save();
  return {
    providerId: row.providerId.toString(),
    date: row.date,
    bookedCount: row.bookedCount,
    maxDailyJobs: row.maxDailyJobs,
    status: row.status,
  };
}

export async function getProviderCapacity(providerId: string, date?: string) {
  const row = await getOrCreateProviderCapacity(providerId, date);
  return {
    providerId: row.providerId.toString(),
    date: row.date,
    bookedCount: row.bookedCount,
    maxDailyJobs: row.maxDailyJobs,
    status: row.status,
    lastUpdatedAt: row.lastUpdatedAt,
  };
}

export async function rollupDailyCapacity(date?: string) {
  const day = date ?? DateTime.now().setZone('Asia/Kolkata').toISODate()!;
  const rows = await ProviderCapacity.find({ date: day });
  let updated = 0;
  for (const row of rows) {
    const next = computeStatus(row.bookedCount, row.maxDailyJobs);
    if (next !== row.status) {
      row.status = next;
      row.lastUpdatedAt = new Date();
      await row.save();
      updated += 1;
    }
  }
  return updated;
}

export function isCapacityBlocking(status: ProviderCapacityStatus): boolean {
  return status === ProviderCapacityStatus.FULL || status === ProviderCapacityStatus.OFFLINE;
}
