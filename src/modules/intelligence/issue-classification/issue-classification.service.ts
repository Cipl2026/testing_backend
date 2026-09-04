import {
  AIAnalysisStatus,
  AIResourceType,
  AnalyticsEventName,
  ConfidenceLevel,
  IntelligenceFeature,
} from '@ghaarfix/shared-types';
import { AIAnalysisJob, AIAnalysisResult } from '@/models/Intelligence.js';
import { getAIProvider } from '@/modules/intelligence/ai-provider/ai-provider.factory.js';
import { validateIssueClassification } from '@/modules/intelligence/intelligence-schemas.js';
import {
  assertCostLimit,
  assertIntelligenceFeatureEnabled,
  findCachedAnalysis,
  hashInput,
  logIntelligenceAudit,
  recordUsage,
  sanitizeTextForAI,
} from '@/modules/intelligence/intelligence-usage.service.js';
import { trackEvent } from '@/modules/discovery-growth/analytics.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function analyzeIssueText(
  customerId: string,
  input: { description: string; homeId?: string; imageFileKey?: string },
) {
  await assertIntelligenceFeatureEnabled(IntelligenceFeature.ISSUE_CLASSIFICATION, customerId);
  await assertCostLimit(IntelligenceFeature.ISSUE_CLASSIFICATION, customerId);

  const sanitized = sanitizeTextForAI(input.description);
  if (sanitized.length < 5) {
    throw new AppError('Please provide a more detailed description.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const provider = getAIProvider();
  const inputHash = hashInput(sanitized);

  const cached = await findCachedAnalysis({
    customerId,
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    inputHash,
    modelVersion: provider.config.version,
  });
  if (cached) {
    return serializeAnalysis(cached);
  }

  const existingPending = await AIAnalysisResult.findOne({
    customerId,
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    inputHash,
    status: { $in: [AIAnalysisStatus.PENDING, AIAnalysisStatus.PROCESSING] },
  });
  if (existingPending) return serializeAnalysis(existingPending);

  const analysis = await AIAnalysisResult.create({
    customerId,
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    resourceType: AIResourceType.ISSUE_TEXT,
    resourceId: input.homeId,
    modelName: provider.config.modelName,
    modelVersion: provider.config.version,
    provider: provider.config.provider,
    status: AIAnalysisStatus.PROCESSING,
    inputHash,
    shadowMode: false,
  });

  const start = Date.now();
  try {
    const raw = await provider.classifyIssue(sanitized, { homeId: input.homeId });
    const result = validateIssueClassification(raw);

    analysis.status = AIAnalysisStatus.COMPLETED;
    analysis.result = result as unknown as Record<string, unknown>;
    analysis.confidence = result.confidence;
    analysis.latencyMs = Date.now() - start;
    analysis.costUnits = 1;
    await analysis.save();

    await recordUsage(IntelligenceFeature.ISSUE_CLASSIFICATION, customerId, analysis.latencyMs);
    await logIntelligenceAudit({
      feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
      provider: provider.config.provider,
      modelName: provider.config.modelName,
      modelVersion: provider.config.version,
      purpose: 'issue_text_classification',
      customerId,
      resourceType: AIResourceType.ISSUE_TEXT,
      resourceId: analysis._id.toString(),
      status: 'SUCCESS',
      latencyMs: analysis.latencyMs,
      costUnits: 1,
    });

    await trackEvent({
      eventName: AnalyticsEventName.ISSUE_ANALYZED,
      customerId,
      properties: {
        confidenceLevel: result.confidenceLevel,
        urgency: result.urgency,
        hasServiceMatch: Boolean(result.serviceId),
      },
    });

    if (input.imageFileKey) {
      const { enqueueImageAnalysis } = await import(
        '@/modules/intelligence/image-analysis/image-analysis.service.js'
      );
      await enqueueImageAnalysis(customerId, input.imageFileKey, analysis._id.toString());
    }

    return serializeAnalysis(analysis);
  } catch (error) {
    analysis.status = AIAnalysisStatus.FAILED;
    analysis.errorMessage = error instanceof Error ? error.message : 'Classification failed';
    analysis.latencyMs = Date.now() - start;
    await analysis.save();
    await recordUsage(IntelligenceFeature.ISSUE_CLASSIFICATION, customerId, analysis.latencyMs, 1, true);

    const fallback = validateIssueClassification({
      category: 'General Home Service',
      confidence: 0.3,
      confidenceLevel: ConfidenceLevel.LOW,
      urgency: 'NORMAL',
      riskFlags: [],
      followUpQuestions: ['Can you describe the issue in more detail?'],
      explanation: 'We could not fully analyze your description. Please provide more details.',
    });

    analysis.status = AIAnalysisStatus.COMPLETED;
    analysis.result = fallback as unknown as Record<string, unknown>;
    analysis.confidence = fallback.confidence;
    await analysis.save();
    return serializeAnalysis(analysis);
  }
}

export async function getAnalysis(customerId: string, analysisId: string) {
  const analysis = await AIAnalysisResult.findById(analysisId);
  if (!analysis) throw new AppError('Analysis not found.', 404, ErrorCode.NOT_FOUND);
  if (analysis.customerId?.toString() !== customerId) {
    throw new AppError('Not authorized.', 403, ErrorCode.FORBIDDEN);
  }
  return serializeAnalysis(analysis);
}

function serializeAnalysis(doc: InstanceType<typeof AIAnalysisResult>) {
  const result = doc.result as Record<string, unknown>;
  const canAutoRecommend =
    result.confidenceLevel === ConfidenceLevel.HIGH ||
    (result.confidenceLevel === ConfidenceLevel.MEDIUM && Boolean(result.serviceId));

  return {
    id: doc._id.toString(),
    feature: doc.feature,
    status: doc.status,
    reviewStatus: doc.reviewStatus,
    result: doc.result,
    confidence: doc.confidence,
    canAutoRecommend,
    requiresClarification:
      result.confidenceLevel === ConfidenceLevel.LOW ||
      (typeof result.confidence === 'number' && result.confidence < 0.5),
    createdAt: doc.createdAt,
  };
}

export async function processPendingImageJobs() {
  const jobs = await AIAnalysisJob.find({ status: 'PENDING' }).limit(10);
  for (const job of jobs) {
    const { processImageAnalysisJob } = await import(
      '@/modules/intelligence/image-analysis/image-analysis.service.js'
    );
    await processImageAnalysisJob(job._id.toString());
  }
  return jobs.length;
}
