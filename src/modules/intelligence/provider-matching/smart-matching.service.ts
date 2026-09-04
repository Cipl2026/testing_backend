import { IntelligenceFeature } from '@ghaarfix/shared-types';
import { ProviderMatchScore } from '@/models/Intelligence.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import type { MatchedProvider } from '@/modules/urgent/urgent-matching.service.js';

const WEIGHTS = {
  distance: 0.35,
  quality: 0.25,
  acceptance: 0.2,
  specialization: 0.1,
  fairness: 0.1,
};

const MODEL_VERSION = 'smart-match-v1';

export interface RankableProvider {
  providerId: string;
  distanceMeters: number;
  baseRankScore?: number;
}

export async function rankEligibleProviders(
  input: {
    serviceId: string;
    candidates: RankableProvider[];
    bookingId?: string;
    urgentRequestId?: string;
    customerPreferredProviderIds?: string[];
  },
  options?: { shadowMode?: boolean },
) {
  if (!input.candidates.length) return [];

  const profiles = await ProviderProfile.find({
    userId: { $in: input.candidates.map((c) => c.providerId) },
  });

  const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

  const maxDistance = Math.max(...input.candidates.map((c) => c.distanceMeters), 1);

  const scored = input.candidates.map((candidate) => {
    const profile = profileMap.get(candidate.providerId);
    const distanceScore = 1 - candidate.distanceMeters / maxDistance;
    const qualityScore = Math.min(1, (profile?.experienceYears ?? 1) / 10);
    const acceptanceScore = profile?.isVerified ? 0.8 : 0.5;
    const specializationScore = 0.7;
    const fairnessScore = 0.5 + (candidate.providerId.charCodeAt(0) % 10) / 20;

    let preferenceBoost = 0;
    if (input.customerPreferredProviderIds?.includes(candidate.providerId)) {
      preferenceBoost = 0.1;
    }

    const factors = [
      {
        factor: 'distance',
        weight: WEIGHTS.distance,
        score: distanceScore,
        description: 'Closer eligible provider',
      },
      {
        factor: 'quality',
        weight: WEIGHTS.quality,
        score: qualityScore,
        description: 'Provider quality score',
      },
      {
        factor: 'acceptance',
        weight: WEIGHTS.acceptance,
        score: acceptanceScore,
        description: 'Acceptance reliability',
      },
      {
        factor: 'specialization',
        weight: WEIGHTS.specialization,
        score: specializationScore,
        description: 'Service specialization',
      },
      {
        factor: 'fairness',
        weight: WEIGHTS.fairness,
        score: fairnessScore,
        description: 'Fair distribution factor',
      },
    ];

    const totalScore =
      factors.reduce((sum, f) => sum + f.weight * f.score, 0) + preferenceBoost;

    return { ...candidate, totalScore, factors };
  });

  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.providerId.localeCompare(b.providerId);
  });

  if (!options?.shadowMode) {
    await ProviderMatchScore.deleteMany({
      bookingId: input.bookingId,
      urgentRequestId: input.urgentRequestId,
    });

    await Promise.all(
      scored.map((s, index) =>
        ProviderMatchScore.create({
          bookingId: input.bookingId,
          urgentRequestId: input.urgentRequestId,
          providerId: s.providerId,
          totalScore: s.totalScore,
          rank: index + 1,
          factors: s.factors,
          modelVersion: MODEL_VERSION,
          selected: index === 0,
        }),
      ),
    );
  }

  return scored.map((s, index) => ({
    providerId: s.providerId,
    distanceMeters: s.distanceMeters,
    rankScore: s.totalScore,
    rank: index + 1,
    summary: buildSummary(s.factors),
    factors: s.factors,
  }));
}

function buildSummary(factors: Array<{ factor: string; description: string; score: number }>) {
  const top = [...factors].sort((a, b) => b.score - a.score).slice(0, 2);
  return top.map((f) => f.description).join('; ');
}

export function applySmartRankingToUrgent(
  matched: MatchedProvider[],
  ranked: Array<{ providerId: string; rankScore: number }>,
): MatchedProvider[] {
  const scoreMap = new Map(ranked.map((r) => [r.providerId, r.rankScore]));
  return [...matched].sort((a, b) => {
    const sa = scoreMap.get(a.providerId) ?? a.rankScore;
    const sb = scoreMap.get(b.providerId) ?? b.rankScore;
    if (sb !== sa) return sb - sa;
    return a.providerId.localeCompare(b.providerId);
  });
}

export async function getProviderMatchingAnalytics() {
  const recent = await ProviderMatchScore.find().sort({ createdAt: -1 }).limit(100);
  const selected = recent.filter((r) => r.selected).length;
  return {
    totalScores: recent.length,
    selectedRate: recent.length ? Math.round((selected / recent.length) * 100) : 0,
    modelVersion: MODEL_VERSION,
    feature: IntelligenceFeature.SMART_PROVIDER_MATCHING,
  };
}
