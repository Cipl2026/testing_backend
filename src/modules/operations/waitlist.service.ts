import { WaitlistStatus, WaitlistUrgency } from '@ghaarfix/shared-types';
import { ErrorCode } from '@ghaarfix/shared-types';
import { ServiceWaitlist } from '@/models/ServiceWaitlist.js';
import { Service } from '@/models/Service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { AppError } from '@/utils/AppError.js';

const NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function buildDedupeKey(customerId: string, serviceId: string, serviceZoneId: string) {
  return `${customerId}:${serviceId}:${serviceZoneId}`;
}

function serializeWaitlist(entry: InstanceType<typeof ServiceWaitlist>) {
  return {
    id: entry._id.toString(),
    customerId: entry.customerId.toString(),
    serviceId: entry.serviceId.toString(),
    serviceZoneId: entry.serviceZoneId.toString(),
    addressId: entry.addressId.toString(),
    status: entry.status,
    urgency: entry.urgency,
    preferredDate: entry.preferredDate,
    notes: entry.notes,
    matchedAt: entry.matchedAt,
    notifiedAt: entry.notifiedAt,
    expiresAt: entry.expiresAt,
    createdAt: entry.createdAt,
  };
}

export async function createWaitlistEntry(
  customerId: string,
  input: {
    serviceId: string;
    serviceZoneId: string;
    addressId: string;
    urgency?: WaitlistUrgency;
    preferredDate?: string;
    notes?: string;
  },
) {
  const service = await Service.findOne({ _id: input.serviceId, isActive: true });
  if (!service) throw new AppError('Service not found.', 404, ErrorCode.NOT_FOUND);

  const dedupeKey = buildDedupeKey(customerId, input.serviceId, input.serviceZoneId);
  const existing = await ServiceWaitlist.findOne({
    customerId,
    dedupeKey,
    status: { $in: [WaitlistStatus.PENDING, WaitlistStatus.NOTIFIED] },
  });
  if (existing) return serializeWaitlist(existing);

  const entry = await ServiceWaitlist.create({
    customerId,
    serviceId: input.serviceId,
    serviceZoneId: input.serviceZoneId,
    addressId: input.addressId,
    status: WaitlistStatus.PENDING,
    urgency: input.urgency ?? WaitlistUrgency.NORMAL,
    preferredDate: input.preferredDate,
    notes: input.notes,
    dedupeKey,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return serializeWaitlist(entry);
}

export async function listCustomerWaitlist(customerId: string) {
  const entries = await ServiceWaitlist.find({
    customerId,
    status: { $ne: WaitlistStatus.CANCELLED },
  }).sort({ createdAt: -1 });
  return entries.map(serializeWaitlist);
}

export async function cancelWaitlistEntry(customerId: string, waitlistId: string) {
  const entry = await ServiceWaitlist.findOne({ _id: waitlistId, customerId });
  if (!entry) throw new AppError('Waitlist entry not found.', 404, ErrorCode.NOT_FOUND);
  entry.status = WaitlistStatus.CANCELLED;
  await entry.save();
}

export async function matchWaitlistOnCapacityIncrease(
  serviceZoneId: string,
  serviceId: string,
): Promise<number> {
  const pending = await ServiceWaitlist.find({
    serviceZoneId,
    serviceId,
    status: WaitlistStatus.PENDING,
  })
    .sort({ urgency: -1, createdAt: 1 })
    .limit(20);

  let matched = 0;
  for (const entry of pending) {
    const now = Date.now();
    if (entry.notifiedAt && now - entry.notifiedAt.getTime() < NOTIFICATION_COOLDOWN_MS) {
      continue;
    }

    entry.status = WaitlistStatus.MATCHED;
    entry.matchedAt = new Date();
    entry.notifiedAt = new Date();
    await entry.save();

    await createNotification({
      userId: entry.customerId.toString(),
      type: 'WAITLIST_MATCH',
      title: 'A slot may be available',
      body: 'Capacity opened up for a service on your waitlist.',
      data: {
        waitlistId: entry._id.toString(),
        serviceId: entry.serviceId.toString(),
      },
    });
    matched += 1;
  }
  return matched;
}

export async function expireStaleWaitlist(): Promise<number> {
  const result = await ServiceWaitlist.updateMany(
    {
      status: { $in: [WaitlistStatus.PENDING, WaitlistStatus.NOTIFIED] },
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: WaitlistStatus.EXPIRED } },
  );
  return result.modifiedCount;
}

export async function listWaitlistAdmin(filters?: {
  serviceZoneId?: string;
  status?: WaitlistStatus;
}) {
  const query: Record<string, unknown> = {};
  if (filters?.serviceZoneId) query.serviceZoneId = filters.serviceZoneId;
  if (filters?.status) query.status = filters.status;
  const entries = await ServiceWaitlist.find(query).sort({ createdAt: -1 }).limit(100);
  return entries.map(serializeWaitlist);
}
