import * as adminService from '@/modules/performance/performance-admin.service.js';
import * as loadTestService from '@/modules/performance/load-test.service.js';
import * as indexAuditService from '@/modules/performance/index-audit.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getPerformanceOverview();
  sendSuccess(res, 'Performance overview fetched', data);
});

export const getApiPerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getApiPerformance();
  sendSuccess(res, 'API performance fetched', data);
});

export const getDatabasePerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getDatabasePerformance();
  sendSuccess(res, 'Database performance fetched', data);
});

export const getSlowQueries = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const collection = req.query.collection as string | undefined;
  const data = await adminService.getSlowQueries(limit, collection);
  sendSuccess(res, 'Slow queries fetched', { items: data });
});

export const getIndexAudit = asyncHandler(async (_req, res) => {
  const data = await adminService.getIndexAudit();
  sendSuccess(res, 'Index audit fetched', data);
});

export const reviewIndex = asyncHandler(async (req, res) => {
  const data = await indexAuditService.reviewIndexRecommendation(
    String(req.params.id),
    req.body.status,
    req.auth?.userId,
  );
  sendSuccess(res, 'Index recommendation reviewed', data);
});

export const getCachePerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getCachePerformance();
  sendSuccess(res, 'Cache performance fetched', data);
});

export const getQueuePerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getQueuePerformance();
  sendSuccess(res, 'Queue performance fetched', data);
});

export const getRealtimePerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getRealtimePerformance();
  sendSuccess(res, 'Realtime performance fetched', data);
});

export const getMobilePerformance = asyncHandler(async (_req, res) => {
  const data = await adminService.getMobilePerformance();
  sendSuccess(res, 'Mobile performance targets fetched', data);
});

export const getLoadTests = asyncHandler(async (_req, res) => {
  const data = await adminService.getLoadTests();
  sendSuccess(res, 'Load tests fetched', data);
});

export const runLoadTest = asyncHandler(async (req, res) => {
  const data = await loadTestService.runLoadTest(String(req.params.id));
  sendSuccess(res, 'Load test completed', data);
});

export const getCapacity = asyncHandler(async (_req, res) => {
  const data = await adminService.getCapacityPlanning();
  sendSuccess(res, 'Capacity plan fetched', data);
});

export const getCosts = asyncHandler(async (_req, res) => {
  const data = await adminService.getCostEfficiency();
  sendSuccess(res, 'Cost efficiency fetched', data);
});

export const getRegressions = asyncHandler(async (_req, res) => {
  const data = await adminService.getRegressions();
  sendSuccess(res, 'Performance regressions fetched', { items: data });
});
