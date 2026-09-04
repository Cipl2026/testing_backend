import {
  ProviderQualityScoreStatus,
  QualityInspectionResult,
  QualityInspectionStatus,
  ReviewStatus,
} from '@ghaarfix/shared-types';
import { ProviderQualityScore, QualityInspection, ServiceProtectionClaim } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { Review } from '@/models/Review.js';
import { ChecklistSnapshot } from '@/models/TrustProtection.js';

export const MIN_QUALITY_SAMPLE = 5;

export async function calculateProviderQualityScore(providerId: string) {
  const completed = await Booking.countDocuments({ providerId, status: BookingStatus.COMPLETED });
  const cancelled = await Booking.countDocuments({ providerId, status: BookingStatus.CANCELLED });
  const claims = await ServiceProtectionClaim.countDocuments({ providerId });
  const reviews = await Review.find({ providerId, status: ReviewStatus.PUBLISHED });
  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const checklistSnapshots = await ChecklistSnapshot.find({
    bookingId: {
      $in: (
        await Booking.find({ providerId, status: BookingStatus.COMPLETED })
          .select('_id')
          .limit(50)
      ).map((b) => b._id),
    },
    completedAt: { $exists: true },
  });
  const complianceRate =
    checklistSnapshots.length > 0
      ? checklistSnapshots.filter((c) => c.items.every((i) => !i.required || i.completed)).length /
        checklistSnapshots.length
      : 1;

  const sampleSize = completed;
  let qualityScore = avgRating * 20;
  let reliabilityScore = completed > 0 ? (1 - cancelled / (completed + cancelled)) * 100 : 50;
  let complianceScore = complianceRate * 100;
  let customerProtectionScore = Math.max(0, 100 - claims * 10);

  if (sampleSize < MIN_QUALITY_SAMPLE) {
    qualityScore = Math.min(qualityScore, 70);
    reliabilityScore = Math.min(reliabilityScore, 70);
  }

  const overallScore =
    qualityScore * 0.35 +
    reliabilityScore * 0.25 +
    complianceScore * 0.2 +
    customerProtectionScore * 0.2;

  let status = ProviderQualityScoreStatus.GOOD;
  if (overallScore >= 85 && sampleSize >= MIN_QUALITY_SAMPLE) status = ProviderQualityScoreStatus.EXCELLENT;
  else if (overallScore < 50 || claims >= 5) status = ProviderQualityScoreStatus.AT_RISK;
  else if (overallScore < 65) status = ProviderQualityScoreStatus.WATCH;

  const recommendedActions: string[] = [];
  if (complianceScore < 80) recommendedActions.push('Complete quality checklists consistently.');
  if (claims > 2) recommendedActions.push('Review recent customer protection claims.');
  if (avgRating < 4 && reviews.length >= 3) recommendedActions.push('Focus on service quality coaching.');

  return ProviderQualityScore.findOneAndUpdate(
    { providerId },
    {
      $set: {
        overallScore: Math.round(overallScore),
        qualityScore: Math.round(qualityScore),
        reliabilityScore: Math.round(reliabilityScore),
        complianceScore: Math.round(complianceScore),
        customerProtectionScore: Math.round(customerProtectionScore),
        status,
        sampleSize,
        recommendedActions,
        lastCalculatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

export async function getProviderQualityForProvider(providerId: string) {
  let score = await ProviderQualityScore.findOne({ providerId });
  if (!score) {
    score = await calculateProviderQualityScore(providerId);
  }

  return {
    status: score?.status,
    dimensions: {
      reliability: 'On-time completion and acceptance reliability',
      quality: 'Customer ratings and inspection outcomes',
      compliance: 'Checklist and evidence compliance',
      customerProtection: 'Claims and repeat issue history',
    },
    recommendedActions: score?.recommendedActions ?? [],
    sampleSize: score?.sampleSize ?? 0,
    message:
      score && score.sampleSize < MIN_QUALITY_SAMPLE
        ? 'Quality insights improve as more completed jobs are recorded.'
        : undefined,
  };
}

export async function createQualityInspection(input: {
  bookingId: string;
  providerId: string;
  inspectorId?: string;
  trigger: string;
}) {
  return QualityInspection.create({
    bookingId: input.bookingId,
    providerId: input.providerId,
    inspectorId: input.inspectorId,
    trigger: input.trigger,
    checklist: [],
    evidence: [],
    status: QualityInspectionStatus.SCHEDULED,
  });
}

export async function completeInspection(
  inspectionId: string,
  input: {
    checklist: Array<{ label: string; passed: boolean; notes?: string }>;
    result: QualityInspectionResult;
    evidence?: string[];
  },
) {
  return QualityInspection.findByIdAndUpdate(
    inspectionId,
    {
      $set: {
        checklist: input.checklist,
        result: input.result,
        evidence: input.evidence ?? [],
        status: QualityInspectionStatus.COMPLETED,
        completedAt: new Date(),
      },
    },
    { new: true },
  );
}

export async function listInspections(query?: { status?: QualityInspectionStatus; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query?.status) filter.status = query.status;
  return QualityInspection.find(filter).sort({ createdAt: -1 }).limit(query?.limit ?? 50);
}

export async function calculateAllProviderScores(): Promise<number> {
  const providers = await Booking.distinct('providerId', { status: BookingStatus.COMPLETED });
  let count = 0;
  for (const providerId of providers.slice(0, 100)) {
    await calculateProviderQualityScore(providerId.toString());
    count += 1;
  }
  return count;
}
