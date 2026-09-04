import { createHash } from 'node:crypto';
import {
  AIAnalysisStatus,
  ErrorCode,
  FeatureFlagKey,
  IntelligenceFeature,
} from '@ghaarfix/shared-types';
import { AIAnalysisResult, AIUsageMetric } from '@/models/Intelligence.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { env } from '@/config/env.js';
import { evaluateFlag } from '@/modules/discovery-growth/feature-flag.service.js';
import { AppError } from '@/utils/AppError.js';
import { DateTime } from 'luxon';

const FEATURE_FLAG_MAP: Partial<Record<IntelligenceFeature, FeatureFlagKey>> = {
  [IntelligenceFeature.ISSUE_CLASSIFICATION]: FeatureFlagKey.ENABLE_AI_ISSUE_CLASSIFICATION,
  [IntelligenceFeature.IMAGE_ANALYSIS]: FeatureFlagKey.ENABLE_AI_IMAGE_ANALYSIS,
  [IntelligenceFeature.PREDICTIVE_MAINTENANCE]: FeatureFlagKey.ENABLE_PREDICTIVE_MAINTENANCE,
  [IntelligenceFeature.SMART_PROVIDER_MATCHING]: FeatureFlagKey.ENABLE_SMART_MATCHING,
  [IntelligenceFeature.DEMAND_FORECAST]: FeatureFlagKey.ENABLE_DEMAND_FORECAST,
  [IntelligenceFeature.ANOMALY_DETECTION]: FeatureFlagKey.ENABLE_ANOMALY_DETECTION,
  [IntelligenceFeature.SUPPORT_ASSISTANT]: FeatureFlagKey.ENABLE_AI_ASSISTANT,
};

export function hashInput(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function assertIntelligenceFeatureEnabled(
  feature: IntelligenceFeature,
  customerId?: string,
): Promise<void> {
  // Local/dev: intelligence should work without admin flag setup.
  if (!env.isProd) return;

  const flagKey = FEATURE_FLAG_MAP[feature];
  if (!flagKey) return;

  const flag = await FeatureFlag.findOne({ key: flagKey.toUpperCase() });
  if (!flag || !flag.enabled) {
    throw new AppError('This intelligence feature is not enabled.', 403, ErrorCode.FORBIDDEN);
  }

  const enabled = await evaluateFlag(flagKey, customerId);
  if (!enabled) {
    throw new AppError('This intelligence feature is not enabled.', 403, ErrorCode.FORBIDDEN);
  }
}

export async function assertCostLimit(_feature: IntelligenceFeature, _customerId?: string): Promise<void> {
  return;
}

export async function recordUsage(
  feature: IntelligenceFeature,
  customerId: string | undefined,
  latencyMs: number,
  costUnits = 1,
  failed = false,
): Promise<void> {
  const period = DateTime.now().toFormat('yyyy-MM-dd');
  await AIUsageMetric.findOneAndUpdate(
    { feature, customerId, period },
    {
      $inc: {
        requestCount: 1,
        costUnits,
        failureCount: failed ? 1 : 0,
      },
      $set: { avgLatencyMs: latencyMs },
    },
    { upsert: true },
  );
}

export async function findCachedAnalysis(input: {
  customerId: string;
  feature: IntelligenceFeature;
  inputHash: string;
  modelVersion: string;
}) {
  return AIAnalysisResult.findOne({
    customerId: input.customerId,
    feature: input.feature,
    inputHash: input.inputHash,
    modelVersion: input.modelVersion,
    status: AIAnalysisStatus.COMPLETED,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
}

export async function assertAnalysisOwnership(analysisId: string, customerId: string) {
  const analysis = await AIAnalysisResult.findById(analysisId);
  if (!analysis) throw new AppError('Analysis not found.', 404, ErrorCode.NOT_FOUND);
  if (analysis.customerId?.toString() !== customerId) {
    throw new AppError('Not authorized to access this analysis.', 403, ErrorCode.FORBIDDEN);
  }
  return analysis;
}

export function sanitizeTextForAI(text: string): string {
  return text
    .replace(/\b\d{10}\b/g, '[PHONE]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]')
    .slice(0, 2000);
}

export async function logIntelligenceAudit(input: {
  feature: IntelligenceFeature;
  provider: string;
  modelName: string;
  modelVersion: string;
  purpose: string;
  customerId?: string;
  resourceType?: string;
  resourceId?: string;
  status: string;
  latencyMs?: number;
  costUnits?: number;
}) {
  const { IntelligenceAuditLog } = await import('@/models/Intelligence.js');
  await IntelligenceAuditLog.create({
    feature: input.feature,
    provider: input.provider,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    purpose: input.purpose,
    customerId: input.customerId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    status: input.status,
    latencyMs: input.latencyMs,
    costUnits: input.costUnits,
  });
}
