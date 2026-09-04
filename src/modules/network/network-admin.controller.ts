import * as overviewService from '@/modules/network/network-overview.service.js';
import * as capacityService from '@/modules/network/capacity-snapshot.service.js';
import * as coverageGapService from '@/modules/network/coverage-gap.service.js';
import * as waitTimeService from '@/modules/network/wait-time.service.js';
import * as qualityService from '@/modules/network/quality-heatmap.service.js';
import * as recruitmentService from '@/modules/network/recruitment.service.js';
import * as launchService from '@/modules/network/launch-readiness.service.js';
import * as expansionService from '@/modules/network/expansion.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await overviewService.getNetworkOverview();
  sendSuccess(res, 'Network overview', data);
});

export const getCapacity = asyncHandler(async (req, res) => {
  const data = await capacityService.listCapacitySnapshots({
    zoneId: req.query.zoneId as string | undefined,
    serviceId: req.query.serviceId as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Capacity snapshots', { items: data });
});

export const getCoverageGaps = asyncHandler(async (req, res) => {
  const data = await coverageGapService.listCoverageGaps({
    zoneId: req.query.zoneId as string | undefined,
    serviceId: req.query.serviceId as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Coverage gaps', { items: data });
});

export const getWaitTimes = asyncHandler(async (req, res) => {
  const zoneId = req.query.zoneId as string;
  const serviceId = req.query.serviceId as string;
  if (!zoneId || !serviceId) {
    sendSuccess(res, 'Wait times', { message: 'Provide zoneId and serviceId' });
    return;
  }
  const data = await waitTimeService.estimateWaitTime({ zoneId, serviceId });
  sendSuccess(res, 'Wait time estimate', data);
});

export const getQuality = asyncHandler(async (req, res) => {
  const data = await qualityService.listQualityHeatmap({
    zoneId: req.query.zoneId as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Quality heatmap', { items: data });
});

export const getRecruitment = asyncHandler(async (req, res) => {
  const data = await recruitmentService.listRecruitmentSignals({
    cityId: req.query.cityId as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Recruitment signals', { items: data });
});

export const getLaunchReadiness = asyncHandler(async (req, res) => {
  const data = await launchService.listLaunchReadiness({
    cityId: req.query.cityId as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Launch readiness', { items: data });
});

export const getExpansion = asyncHandler(async (req, res) => {
  const data = await expansionService.listExpansionRecommendations({
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Expansion recommendations', { items: data });
});

export const acknowledgeExpansion = asyncHandler(async (req, res) => {
  const data = await expansionService.acknowledgeExpansion(String(req.params.id));
  sendSuccess(res, 'Expansion acknowledged', data);
});

export const createLaunchPlan = asyncHandler(async (req, res) => {
  const data = await launchService.createLaunchPlan(req.auth!.userId, req.body);
  sendSuccess(res, 'Launch plan created', data, 201);
});

export const listSupplyAlerts = asyncHandler(async (req, res) => {
  const data = await overviewService.listSupplyAlerts({
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  sendSuccess(res, 'Supply alerts', { items: data });
});
