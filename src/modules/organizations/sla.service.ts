import { SLAPriority, SLAStatus } from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { ServiceLevelAgreement, SLATracker } from '@/models/OrganizationOperations.js';
import { Booking } from '@/models/Booking.js';

export async function createSlaTrackerForBooking(
  organizationId: string,
  bookingId: string,
  serviceId?: string,
) {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const sla = await ServiceLevelAgreement.findOne({
    organizationId,
    isActive: true,
    $or: [{ serviceId }, { serviceId: { $exists: false } }],
  }).sort({ priority: -1 });

  const responseMinutes = sla?.responseTargetMinutes ?? 120;
  const completionMinutes = sla?.completionTargetMinutes ?? 480;
  const createdAt = booking.createdAt ?? new Date();

  return SLATracker.create({
    organizationId,
    bookingId,
    slaId: sla?._id,
    status: SLAStatus.ON_TRACK,
    responseTargetAt: DateTime.fromJSDate(createdAt).plus({ minutes: responseMinutes }).toJSDate(),
    completionTargetAt: DateTime.fromJSDate(createdAt).plus({ minutes: completionMinutes }).toJSDate(),
  });
}

export async function recordSlaEvent(
  bookingId: string,
  event: 'ASSIGNED' | 'ACCEPTED' | 'ARRIVED' | 'COMPLETED',
) {
  const tracker = await SLATracker.findOne({ bookingId });
  if (!tracker) return null;

  const now = new Date();
  if (event === 'ASSIGNED') tracker.providerAssignedAt = now;
  if (event === 'ACCEPTED') tracker.providerAcceptedAt = now;
  if (event === 'ARRIVED') tracker.providerArrivedAt = now;
  if (event === 'COMPLETED') {
    tracker.completedAt = now;
    if (tracker.completionTargetAt && now > tracker.completionTargetAt) {
      tracker.status = SLAStatus.BREACHED;
      tracker.breachReason = 'Completion target exceeded';
    }
  }

  if (tracker.responseTargetAt && !tracker.providerAcceptedAt && now > tracker.responseTargetAt) {
    tracker.status = SLAStatus.AT_RISK;
  }

  await tracker.save();
  return tracker;
}

export async function monitorActiveSlas() {
  const now = new Date();
  const atRisk = await SLATracker.updateMany(
    {
      status: SLAStatus.ON_TRACK,
      completionTargetAt: { $lte: DateTime.now().plus({ minutes: 30 }).toJSDate(), $gte: now },
    },
    { status: SLAStatus.AT_RISK },
  );

  const breached = await SLATracker.updateMany(
    {
      status: { $in: [SLAStatus.ON_TRACK, SLAStatus.AT_RISK] },
      completionTargetAt: { $lt: now },
    },
    { status: SLAStatus.BREACHED, breachReason: 'SLA completion deadline passed' },
  );

  return { atRisk: atRisk.modifiedCount, breached: breached.modifiedCount };
}

export async function listOrganizationSla(userId: string, organizationId: string) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  const { OrganizationPermission } = await import('@ghaarfix/shared-types');
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);

  const items = await SLATracker.find({ organizationId }).sort({ updatedAt: -1 }).limit(100);
  return items.map((t) => ({
    bookingId: t.bookingId.toString(),
    status: t.status,
    responseTargetAt: t.responseTargetAt,
    completionTargetAt: t.completionTargetAt,
    breachReason: t.breachReason,
  }));
}

export async function createDefaultSla(
  organizationId: string,
  input?: { responseTargetMinutes?: number; completionTargetMinutes?: number },
) {
  return ServiceLevelAgreement.create({
    organizationId,
    priority: SLAPriority.NORMAL,
    responseTargetMinutes: input?.responseTargetMinutes ?? 120,
    completionTargetMinutes: input?.completionTargetMinutes ?? 480,
    isActive: true,
  });
}
