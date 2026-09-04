import { IoTProviderType } from '@ghaarfix/shared-types';
import * as connectionService from '@/modules/iot/connection.service.js';
import * as deviceService from '@/modules/iot/device.service.js';
import * as alertService from '@/modules/iot/alert.service.js';
import * as insightService from '@/modules/iot/insight.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listConnections = asyncHandler(async (req, res) => {
  const items = await connectionService.listConnections(req.auth!.userId);
  sendSuccess(res, 'Connections fetched', { items });
});

export const connectProvider = asyncHandler(async (req, res) => {
  const result = await connectionService.connectProvider(
    req.auth!.userId,
    req.params.provider as IoTProviderType,
    req.body,
  );
  sendSuccess(res, 'Provider connected', result, 201);
});

export const disconnectConnection = asyncHandler(async (req, res) => {
  const result = await connectionService.disconnectConnection(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Connection disconnected', result);
});

export const discoverDevices = asyncHandler(async (req, res) => {
  const items = await deviceService.discoverDevices(req.auth!.userId, String(req.params.connectionId));
  sendSuccess(res, 'Devices discovered', { items });
});

export const listDevices = asyncHandler(async (req, res) => {
  const items = await deviceService.listDevices(req.auth!.userId, {
    homeId: req.query.homeId as string | undefined,
  });
  sendSuccess(res, 'Devices fetched', { items });
});

export const getDevice = asyncHandler(async (req, res) => {
  const device = await deviceService.getDevice(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Device fetched', device);
});

export const approveDevice = asyncHandler(async (req, res) => {
  const device = await deviceService.approveDevice(
    req.auth!.userId,
    String(req.params.id),
    req.body.homeId,
  );
  sendSuccess(res, 'Device approved', device);
});

export const removeDevice = asyncHandler(async (req, res) => {
  const result = await deviceService.removeDevice(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Device removed', result);
});

export const linkDevice = asyncHandler(async (req, res) => {
  const link = await deviceService.linkDeviceToAsset(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Device linked', link);
});

export const listAlerts = asyncHandler(async (req, res) => {
  const items = await alertService.listAlerts(req.auth!.userId, {
    homeId: req.query.homeId as string | undefined,
    status: req.query.status as string | undefined,
  });
  sendSuccess(res, 'Alerts fetched', { items });
});

export const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await alertService.acknowledgeAlert(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Alert acknowledged', alert);
});

export const alertFeedback = asyncHandler(async (req, res) => {
  const alert = await alertService.submitAlertFeedback(
    req.auth!.userId,
    String(req.params.id),
    req.body.feedback,
  );
  sendSuccess(res, 'Feedback recorded', alert);
});

export const getInsights = asyncHandler(async (req, res) => {
  const homeId = String(req.query.homeId);
  const items = await insightService.getHomeInsights(req.auth!.userId, homeId);
  sendSuccess(res, 'Insights fetched', { items });
});
