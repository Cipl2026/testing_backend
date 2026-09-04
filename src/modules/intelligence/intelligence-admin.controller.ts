import * as anomalyService from '@/modules/intelligence/anomaly-detection/anomaly-detection.service.js';
import * as forecastService from '@/modules/intelligence/demand-forecasting/demand-forecast.service.js';
import * as modelService from '@/modules/intelligence/evaluation/model-registry.service.js';
import * as matchingService from '@/modules/intelligence/provider-matching/smart-matching.service.js';
import { generateDataReadinessReport } from '@/modules/intelligence/data-quality/data-readiness.service.js';
import { KnowledgeChunk, KnowledgeSource } from '@/models/Intelligence.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getDashboard = asyncHandler(async (_req, res) => {
  const data = await anomalyService.getIntelligenceDashboard();
  sendSuccess(res, 'Intelligence dashboard', data);
});

export const getDemandForecast = asyncHandler(async (req, res) => {
  const items = await forecastService.listDemandForecasts({
    cityId: req.query.cityId as string | undefined,
    serviceZoneId: req.query.serviceZoneId as string | undefined,
    serviceId: req.query.serviceId as string | undefined,
  });
  sendSuccess(res, 'Demand forecast', { items });
});

export const listAnomalies = asyncHandler(async (req, res) => {
  const items = await anomalyService.listAnomalies({
    status: req.query.status as string | undefined,
  });
  sendSuccess(res, 'Anomalies fetched', { items });
});

export const acknowledgeAnomaly = asyncHandler(async (req, res) => {
  const item = await anomalyService.acknowledgeAnomaly(String(req.params.id));
  sendSuccess(res, 'Anomaly acknowledged', item);
});

export const listModels = asyncHandler(async (_req, res) => {
  const items = await modelService.listModels();
  sendSuccess(res, 'Models fetched', { items });
});

export const activateModel = asyncHandler(async (req, res) => {
  const item = await modelService.activateModel(String(req.params.id));
  sendSuccess(res, 'Model activated', item);
});

export const getProviderMatchingAnalytics = asyncHandler(async (_req, res) => {
  const data = await matchingService.getProviderMatchingAnalytics();
  sendSuccess(res, 'Provider matching analytics', data);
});

export const getDataReadiness = asyncHandler(async (_req, res) => {
  const report = await generateDataReadinessReport();
  sendSuccess(res, 'Data readiness report', report);
});

export const listKnowledgeSources = asyncHandler(async (_req, res) => {
  const items = await KnowledgeSource.find().sort({ updatedAt: -1 });
  sendSuccess(res, 'Knowledge sources', {
    items: items.map((s) => ({
      id: s._id.toString(),
      type: s.type,
      title: s.title,
      slug: s.slug,
      version: s.version,
      isActive: s.isActive,
    })),
  });
});

export const createKnowledgeSource = asyncHandler(async (req, res) => {
  const source = await KnowledgeSource.create(req.body);
  sendSuccess(res, 'Knowledge source created', { id: source._id.toString() }, 201);
});

export const addKnowledgeChunk = asyncHandler(async (req, res) => {
  const chunk = await KnowledgeChunk.create({
    sourceId: req.params.id,
    content: req.body.content,
  });
  sendSuccess(res, 'Chunk added', { id: chunk._id.toString() }, 201);
});
