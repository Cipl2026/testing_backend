import {
  AIAnalysisStatus,
  AIResourceType,
  IntelligenceFeature,
} from '@ghaarfix/shared-types';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AIAnalysisJob, AIAnalysisResult } from '@/models/Intelligence.js';
import { env } from '@/config/env.js';
import { getAIProvider } from '@/modules/intelligence/ai-provider/ai-provider.factory.js';
import { validateImageClassification } from '@/modules/intelligence/intelligence-schemas.js';
import {
  assertCostLimit,
  assertIntelligenceFeatureEnabled,
  logIntelligenceAudit,
  recordUsage,
} from '@/modules/intelligence/intelligence-usage.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = env.storage.maxFileSizeBytes;

export async function enqueueImageAnalysis(
  customerId: string,
  fileKey: string,
  linkedAnalysisId?: string,
) {
  await assertIntelligenceFeatureEnabled(IntelligenceFeature.IMAGE_ANALYSIS, customerId);
  await assertCostLimit(IntelligenceFeature.IMAGE_ANALYSIS, customerId);

  const filePath = path.join(env.storage.uploadDir, fileKey);
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_BYTES) {
      throw new AppError('Image too large for analysis.', 400, ErrorCode.VALIDATION_ERROR);
    }
  } catch {
    throw new AppError('Image not found.', 404, ErrorCode.NOT_FOUND);
  }

  const provider = getAIProvider();
  const idempotencyKey = createHash('sha256').update(`${customerId}:${fileKey}`).digest('hex');

  const existing = await AIAnalysisJob.findOne({ idempotencyKey });
  if (existing) {
    const analysis = await AIAnalysisResult.findById(existing.analysisId);
    if (analysis) return { analysisId: analysis._id.toString(), status: analysis.status };
  }

  const analysis = await AIAnalysisResult.create({
    customerId,
    feature: IntelligenceFeature.IMAGE_ANALYSIS,
    resourceType: AIResourceType.ISSUE_IMAGE,
    resourceId: fileKey,
    modelName: provider.config.modelName,
    modelVersion: provider.config.version,
    provider: provider.config.provider,
    status: AIAnalysisStatus.PENDING,
    inputHash: idempotencyKey,
    shadowMode: false,
    result: linkedAnalysisId ? { linkedTextAnalysisId: linkedAnalysisId } : {},
  });

  await AIAnalysisJob.create({
    analysisId: analysis._id,
    status: 'PENDING',
    idempotencyKey,
  });

  return { analysisId: analysis._id.toString(), status: AIAnalysisStatus.PENDING };
}

export async function processImageAnalysisJob(jobId: string) {
  const job = await AIAnalysisJob.findById(jobId);
  if (!job || job.status === 'COMPLETED') return;

  const analysis = await AIAnalysisResult.findById(job.analysisId);
  if (!analysis) return;

  job.status = 'PROCESSING';
  job.attempts += 1;
  await job.save();

  analysis.status = AIAnalysisStatus.PROCESSING;
  await analysis.save();

  const fileKey = analysis.resourceId;
  if (!fileKey) {
    job.status = 'FAILED';
    job.lastError = 'Missing file key';
    await job.save();
    return;
  }

  const filePath = path.join(env.storage.uploadDir, fileKey);
  const start = Date.now();

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(fileKey).toLowerCase();
    const mimeType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    if (!ALLOWED_MIME.has(mimeType)) {
      throw new AppError('Unsupported image type.', 400, ErrorCode.VALIDATION_ERROR);
    }

    const provider = getAIProvider();
    const raw = await provider.classifyImage(buffer, mimeType);
    const result = validateImageClassification(raw);

    analysis.status = AIAnalysisStatus.COMPLETED;
    analysis.result = { ...analysis.result, imageAnalysis: result };
    analysis.confidence = result.confidence;
    analysis.latencyMs = Date.now() - start;
    await analysis.save();

    job.status = 'COMPLETED';
    await job.save();

    await recordUsage(
      IntelligenceFeature.IMAGE_ANALYSIS,
      analysis.customerId?.toString(),
      analysis.latencyMs,
    );
    await logIntelligenceAudit({
      feature: IntelligenceFeature.IMAGE_ANALYSIS,
      provider: provider.config.provider,
      modelName: provider.config.modelName,
      modelVersion: provider.config.version,
      purpose: 'image_classification',
      customerId: analysis.customerId?.toString(),
      resourceType: AIResourceType.ISSUE_IMAGE,
      resourceId: fileKey,
      status: 'SUCCESS',
      latencyMs: analysis.latencyMs,
    });
  } catch (error) {
    job.status = job.attempts >= 3 ? 'FAILED' : 'PENDING';
    job.lastError = error instanceof Error ? error.message : 'Image analysis failed';
    await job.save();

    analysis.status = AIAnalysisStatus.FAILED;
    analysis.errorMessage = job.lastError;
    await analysis.save();
  }
}
