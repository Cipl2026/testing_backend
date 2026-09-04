import * as connectionService from '@/modules/iot/connection.service.js';
import * as organizationIoTService from '@/modules/iot/organization-iot.service.js';
import { ingestWebhookEvent } from '@/modules/iot/event-ingestion.service.js';
import {
  ConnectedDevice,
  HomeAlert,
  IoTEvent,
  IoTIntegrationConnection,
  IoTIntegrationHealth,
  IoTRuleTemplate,
} from '@/models/IoT.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const webhookIngest = asyncHandler(async (req, res) => {
  const result = await ingestWebhookEvent({
    connectionId: String(req.params.connectionId),
    payload: req.body,
    rawBody: (req as { rawBody?: string }).rawBody ?? JSON.stringify(req.body),
    signature: req.headers['x-ghaarfix-signature'] as string | undefined,
    timestamp: req.headers['x-ghaarfix-timestamp'] as string | undefined,
  });
  sendSuccess(res, 'Event ingested', result, result.duplicate ? 200 : 201);
});

export const orgListDevices = asyncHandler(async (req, res) => {
  const items = await organizationIoTService.listOrganizationDevices(
    req.auth!.userId,
    String(req.params.id),
  );
  sendSuccess(res, 'Organization devices fetched', { items });
});

export const orgListAlerts = asyncHandler(async (req, res) => {
  const items = await organizationIoTService.listOrganizationAlerts(
    req.auth!.userId,
    String(req.params.id),
  );
  sendSuccess(res, 'Organization alerts fetched', { items });
});

export const adminOverview = asyncHandler(async (_req, res) => {
  const [devices, connections, events, alerts, health] = await Promise.all([
    ConnectedDevice.countDocuments({ status: { $ne: 'REMOVED' } }),
    IoTIntegrationConnection.countDocuments({ status: 'CONNECTED' }),
    IoTEvent.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    HomeAlert.countDocuments({ status: 'ACTIVE' }),
    IoTIntegrationHealth.find().limit(20),
  ]);
  sendSuccess(res, 'IoT overview', { devices, connections, events24h: events, activeAlerts: alerts, health });
});

export const adminListEvents = asyncHandler(async (req, res) => {
  const items = await IoTEvent.find()
    .sort({ occurredAt: -1 })
    .limit(Number(req.query.limit) || 50);
  sendSuccess(res, 'Events fetched', { items });
});

export const adminListIntegrations = asyncHandler(async (_req, res) => {
  const items = await IoTIntegrationConnection.find().sort({ updatedAt: -1 }).limit(50);
  sendSuccess(res, 'Integrations fetched', { items });
});

export const adminIntegrationHealth = asyncHandler(async (_req, res) => {
  const items = await IoTIntegrationHealth.find().sort({ updatedAt: -1 });
  sendSuccess(res, 'Integration health', { items });
});

export const adminListRuleTemplates = asyncHandler(async (_req, res) => {
  const items = await IoTRuleTemplate.find().sort({ updatedAt: -1 });
  sendSuccess(res, 'Rule templates fetched', { items });
});

export const adminCreateRuleTemplate = asyncHandler(async (req, res) => {
  const template = await IoTRuleTemplate.create(req.body);
  sendSuccess(res, 'Rule template created', { id: template._id.toString() }, 201);
});

export const adminActivateRuleTemplate = asyncHandler(async (req, res) => {
  const template = await IoTRuleTemplate.findByIdAndUpdate(
    req.params.id,
    { status: 'ACTIVE' },
    { new: true },
  );
  sendSuccess(res, 'Rule template activated', template);
});

export const adminGetConnection = asyncHandler(async (req, res) => {
  const connection = await connectionService.getConnectionById(String(req.params.id));
  sendSuccess(res, 'Connection fetched', {
    id: connection._id.toString(),
    provider: connection.provider,
    status: connection.status,
  });
});
