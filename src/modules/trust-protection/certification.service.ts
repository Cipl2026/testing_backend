import { ErrorCode, ServiceCertificationLevel, ServiceCertificationStatus } from '@ghaarfix/shared-types';
import { ProviderServiceCertification } from '@/models/TrustProtection.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus, ProviderBadge } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

export async function grantCertification(
  adminId: string,
  input: {
    providerId: string;
    serviceId: string;
    level: ServiceCertificationLevel;
    expiresAt?: Date;
    requirements?: string[];
  },
) {
  const completedJobs = await Booking.countDocuments({
    providerId: input.providerId,
    serviceId: input.serviceId,
    status: BookingStatus.COMPLETED,
  });

  if (completedJobs < 5 && input.level !== ServiceCertificationLevel.VERIFIED) {
    throw new AppError('Minimum successful jobs required for certification level.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const cert = await ProviderServiceCertification.findOneAndUpdate(
    { providerId: input.providerId, serviceId: input.serviceId },
    {
      $set: {
        level: input.level,
        verifiedAt: new Date(),
        expiresAt: input.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: ServiceCertificationStatus.ACTIVE,
        requirements: input.requirements ?? ['Training completed', 'Inspection passed'],
      },
    },
    { upsert: true, new: true },
  );

  await syncTrustBadges(input.providerId);

  await AdminAuditLog.create({
    adminId,
    action: 'CERTIFICATION_GRANTED',
    entityType: 'ProviderServiceCertification',
    entityId: cert._id,
    after: { level: input.level },
    reason: 'Certification granted by admin review',
  });

  return cert;
}

export async function revokeCertification(adminId: string, certId: string, reason: string) {
  const cert = await ProviderServiceCertification.findByIdAndUpdate(
    certId,
    { status: ServiceCertificationStatus.REVOKED },
    { new: true },
  );

  if (cert) {
    await syncTrustBadges(cert.providerId.toString());
    await AdminAuditLog.create({
      adminId,
      action: 'CERTIFICATION_REVOKED',
      entityType: 'ProviderServiceCertification',
      entityId: cert._id,
      reason,
    });
  }

  return cert;
}

export async function listProviderCertifications(providerId: string) {
  return ProviderServiceCertification.find({
    providerId,
    status: ServiceCertificationStatus.ACTIVE,
  });
}

export async function expireCertifications(): Promise<number> {
  const result = await ProviderServiceCertification.updateMany(
    {
      status: ServiceCertificationStatus.ACTIVE,
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: ServiceCertificationStatus.EXPIRED } },
  );
  return result.modifiedCount;
}

async function syncTrustBadges(providerId: string) {
  const certs = await ProviderServiceCertification.find({
    providerId,
    status: ServiceCertificationStatus.ACTIVE,
  });

  const badges: ProviderBadge[] = [];
  if (certs.some((c) => c.level === ServiceCertificationLevel.SPECIALIST)) {
    badges.push(ProviderBadge.SPECIALIST);
    badges.push(ProviderBadge.GHAARFIX_CERTIFIED);
  } else if (certs.some((c) => c.level === ServiceCertificationLevel.ADVANCED)) {
    badges.push(ProviderBadge.HIGHLY_RELIABLE);
  } else if (certs.length > 0) {
    badges.push(ProviderBadge.VERIFIED_PROFESSIONAL);
  }

  const metrics = await ProviderTrustMetrics.findOne({ providerId });
  if (metrics) {
    const merged = [...new Set([...metrics.badges, ...badges])];
    metrics.badges = merged;
    await metrics.save();
  }
}

export async function getProviderTrustInfo(providerId: string) {
  const certs = await listProviderCertifications(providerId);
  const metrics = await ProviderTrustMetrics.findOne({ providerId });

  const reasons: string[] = [];
  if (metrics?.badges.includes(ProviderBadge.IDENTITY_VERIFIED)) {
    reasons.push('Verified identity');
  }
  if (certs.length > 0) {
    reasons.push('GhaarFix service certification');
  }
  if ((metrics?.averageRating ?? 0) >= 4.5 && (metrics?.completedJobs ?? 0) >= 20) {
    reasons.push('Strong service reliability history');
  }

  return {
    badges: metrics?.badges ?? [],
    certifications: certs.map((c) => ({
      serviceId: c.serviceId.toString(),
      level: c.level,
      expiresAt: c.expiresAt,
    })),
    trustExplanation: reasons.length
      ? reasons.join(' and ') + '.'
      : 'Provider meets standard platform requirements.',
  };
}
