import {
  BookingStatus,
  OperationalRiskEntityType,
  OperationalRiskSeverity,
  OperationalRiskSignalStatus,
  OperationalRiskSignalType,
  PriceChangeStatus,
  ProviderRequestStatus,
} from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { Booking } from '@/models/Booking.js';
import { OperationalRiskSignal } from '@/models/OperationalRiskSignal.js';
import { PriceChangeRequest } from '@/models/PriceChangeRequest.js';
import { SupportTicket } from '@/models/SupportTicket.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

async function upsertSignal(input: {
  entityType: OperationalRiskEntityType;
  entityId: string;
  signalType: OperationalRiskSignalType;
  severity: OperationalRiskSeverity;
  details: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await OperationalRiskSignal.findOne({
    entityType: input.entityType,
    entityId: input.entityId,
    signalType: input.signalType,
    status: { $in: [OperationalRiskSignalStatus.NEW, OperationalRiskSignalStatus.UNDER_REVIEW] },
  });
  if (existing) return { signal: existing, isNew: false };

  const signal = await OperationalRiskSignal.create({
    entityType: input.entityType,
    entityId: input.entityId,
    signalType: input.signalType,
    severity: input.severity,
    status: OperationalRiskSignalStatus.NEW,
    details: input.details,
    metadata: input.metadata,
    detectedAt: new Date(),
  });
  return { signal, isNew: true };
}

export async function detectOperationalSignals(): Promise<number> {
  let created = 0;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const providers = await Booking.distinct('providerId', { createdAt: { $gte: since } });
  for (const providerId of providers) {
    const pid = providerId.toString();
    const [cancelled, accepted, priceChanges, rejectedPriceChanges, complaints] = await Promise.all([
      Booking.countDocuments({
        providerId: pid,
        status: BookingStatus.CANCELLED,
        'cancellation.actorRole': 'PROVIDER',
        updatedAt: { $gte: since },
      }),
      Booking.countDocuments({
        providerId: pid,
        providerRequestStatus: ProviderRequestStatus.ACCEPTED,
        createdAt: { $gte: since },
      }),
      PriceChangeRequest.countDocuments({ providerId: pid, createdAt: { $gte: since } }),
      PriceChangeRequest.countDocuments({
        providerId: pid,
        createdAt: { $gte: since },
        status: PriceChangeStatus.REJECTED,
      }),
      SupportTicket.countDocuments({ providerId: pid, createdAt: { $gte: since } }),
    ]);

    if (accepted >= 5 && cancelled / accepted > 0.3) {
      const { isNew } = await upsertSignal({
        entityType: OperationalRiskEntityType.PROVIDER,
        entityId: pid,
        signalType: OperationalRiskSignalType.HIGH_CANCELLATION_RATE,
        severity: OperationalRiskSeverity.MEDIUM,
        details: `Provider cancelled ${cancelled} of ${accepted} accepted bookings in the last 30 days.`,
        metadata: { cancelled, accepted },
      });
      if (isNew) created += 1;
    }

    if (priceChanges >= 5 && rejectedPriceChanges / priceChanges > 0.5) {
      const { isNew } = await upsertSignal({
        entityType: OperationalRiskEntityType.PROVIDER,
        entityId: pid,
        signalType: OperationalRiskSignalType.EXCESSIVE_PRICE_CHANGE_REQUESTS,
        severity: OperationalRiskSeverity.MEDIUM,
        details: `${priceChanges} price change requests with high rejection rate in the last 30 days.`,
        metadata: { priceChanges, rejectedPriceChanges },
      });
      if (isNew) created += 1;
    }

    if (complaints >= 3) {
      const { isNew } = await upsertSignal({
        entityType: OperationalRiskEntityType.PROVIDER,
        entityId: pid,
        signalType: OperationalRiskSignalType.REPEATED_CUSTOMER_COMPLAINTS,
        severity: OperationalRiskSeverity.HIGH,
        details: `${complaints} customer complaints in the last 30 days.`,
        metadata: { complaints },
      });
      if (isNew) created += 1;
    }
  }

  return created;
}

export async function adminListSignals(query: { status?: OperationalRiskSignalStatus }) {
  const filter = query.status ? { status: query.status } : {};
  const items = await OperationalRiskSignal.find(filter).sort({ detectedAt: -1 }).limit(100);
  return items.map((s) => ({
    id: s._id.toString(),
    entityType: s.entityType,
    entityId: s.entityId.toString(),
    signalType: s.signalType,
    severity: s.severity,
    status: s.status,
    details: s.details,
    detectedAt: s.detectedAt.toISOString(),
  }));
}

export async function adminUpdateSignal(
  adminId: string,
  signalId: string,
  input: {
    status: OperationalRiskSignalStatus;
    resolutionNote?: string;
  },
) {
  const signal = await OperationalRiskSignal.findById(signalId);
  if (!signal) throw new AppError('Signal not found.', 404, ErrorCode.NOT_FOUND);
  const before = { status: signal.status };
  signal.status = input.status;
  if (
    input.status === OperationalRiskSignalStatus.DISMISSED ||
    input.status === OperationalRiskSignalStatus.RESOLVED
  ) {
    signal.resolvedAt = new Date();
    signal.resolvedBy = adminId as never;
    signal.resolutionNote = input.resolutionNote;
  }
  await signal.save();

  await AdminAuditLog.create({
    adminId,
    action: input.status === OperationalRiskSignalStatus.DISMISSED ? 'RISK_SIGNAL_DISMISSED' : 'RISK_SIGNAL_RESOLVED',
    entityType: 'OPERATIONAL_RISK_SIGNAL',
    entityId: signal._id,
    before,
    after: { status: signal.status },
    reason: input.resolutionNote ?? 'Admin review',
  });

  return { id: signal._id.toString(), status: signal.status };
}

export async function getOperationsDashboard() {
  const [openSignals, recentComplaints, pendingVerifications] = await Promise.all([
    OperationalRiskSignal.countDocuments({
      status: { $in: [OperationalRiskSignalStatus.NEW, OperationalRiskSignalStatus.UNDER_REVIEW] },
    }),
    SupportTicket.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    import('@/models/ProviderVerification.js').then((m) =>
      m.ProviderVerification.countDocuments({ status: 'PENDING' }),
    ),
  ]);

  return {
    openOperationalSignals: openSignals,
    complaintsLast7Days: recentComplaints,
    pendingVerifications,
  };
}
