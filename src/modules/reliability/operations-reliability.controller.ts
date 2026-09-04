import { getCurrentReleaseInfo } from '@/modules/reliability/release-health.service.js';
import * as opsService from '@/modules/reliability/operations-reliability.service.js';
import * as alertService from '@/modules/reliability/alert.service.js';
import * as incidentService from '@/modules/reliability/incident.service.js';
import * as dlqService from '@/modules/reliability/dlq.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await opsService.getOperationsOverview();
  sendSuccess(res, 'Operations overview fetched', data);
});

export const getServices = asyncHandler(async (_req, res) => {
  const data = await opsService.getServiceHealth();
  sendSuccess(res, 'Service health fetched', data);
});

export const getErrors = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  const data = await opsService.getErrorExplorer(limit);
  sendSuccess(res, 'Errors fetched', { items: data });
});

export const getQueues = asyncHandler(async (_req, res) => {
  const data = await opsService.getQueueHealth();
  sendSuccess(res, 'Queue health fetched', data);
});

export const getSlo = asyncHandler(async (_req, res) => {
  const data = await opsService.getSloDashboard();
  sendSuccess(res, 'SLO dashboard fetched', { items: data });
});

export const getAlerts = asyncHandler(async (_req, res) => {
  const data = await opsService.getAlertsDashboard();
  sendSuccess(res, 'Alerts fetched', { items: data });
});

export const acknowledgeAlert = asyncHandler(async (req, res) => {
  const data = await alertService.acknowledgeAlert(String(req.params.id), req.auth!.userId);
  sendSuccess(res, 'Alert acknowledged', data);
});

export const listIncidents = asyncHandler(async (_req, res) => {
  const data = await opsService.getIncidentsDashboard();
  sendSuccess(res, 'Incidents fetched', { items: data });
});

export const createIncident = asyncHandler(async (req, res) => {
  const data = await incidentService.createIncident({
    ...req.body,
    ownerId: req.auth!.userId,
  });
  sendSuccess(res, 'Incident created', data, 201);
});

export const updateIncident = asyncHandler(async (req, res) => {
  const data = await incidentService.updateIncident(String(req.params.id), {
    ...req.body,
    actorId: req.auth!.userId,
  });
  sendSuccess(res, 'Incident updated', data);
});

export const getDlq = asyncHandler(async (_req, res) => {
  const data = await opsService.getQueueHealth();
  sendSuccess(res, 'DLQ fetched', { items: data.recentDlq, summary: data.summary });
});

export const retryDlq = asyncHandler(async (req, res) => {
  const data = await dlqService.retryDeadLetterJob(String(req.params.id), req.auth!.userId);
  sendSuccess(res, 'DLQ job marked for retry', data);
});

export const discardDlq = asyncHandler(async (req, res) => {
  const data = await dlqService.discardDeadLetterJob(
    String(req.params.id),
    req.body.reason ?? 'Discarded by admin',
  );
  sendSuccess(res, 'DLQ job discarded', data);
});

export const getBackups = asyncHandler(async (_req, res) => {
  const data = await opsService.getBackupsDashboard();
  sendSuccess(res, 'Backup verifications fetched', { items: data });
});

export const getReleases = asyncHandler(async (_req, res) => {
  const [items, current] = await Promise.all([
    opsService.getReleasesDashboard(),
    Promise.resolve(getCurrentReleaseInfo()),
  ]);
  sendSuccess(res, 'Release health fetched', { items, current });
});

export const getDetailedHealth = asyncHandler(async (_req, res) => {
  const data = await opsService.getServiceHealth();
  sendSuccess(res, 'Detailed health fetched', data);
});
