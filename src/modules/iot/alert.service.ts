import {
  AlertFeedbackType,
  ErrorCode,
  FeatureFlagKey,
  HomeAlertSeverity,
  HomeAlertSource,
  HomeAlertStatus,
  HomeCapability,
  IoTEventSeverity,
} from '@ghaarfix/shared-types';
import { ConnectedDevice, HomeAlert, IoTEvent } from '@/models/IoT.js';
import { assertIoTEnabled } from '@/modules/iot/connection.service.js';
import { evaluateFlag } from '@/modules/discovery-growth/feature-flag.service.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { AppError } from '@/utils/AppError.js';

const SAFETY_DISCLAIMER =
  'Do not rely solely on this app for life-critical decisions. Contact emergency services if you are in immediate danger.';

export async function createAlertFromEvent(
  event: InstanceType<typeof IoTEvent>,
  device: InstanceType<typeof ConnectedDevice>,
  override?: { title?: string; message?: string },
) {
  if (!device.homeId) return null;

  const severity = mapEventSeverityToAlert(event.severity);
  const dedupeKey = `event:${event._id.toString()}`;

  const existing = await HomeAlert.findOne({ dedupeKey, status: { $in: [HomeAlertStatus.ACTIVE, HomeAlertStatus.ACKNOWLEDGED] } });
  if (existing) return existing;

  const isCritical = severity === HomeAlertSeverity.CRITICAL;
  const recommendedActions = buildRecommendedActions(event.eventType, isCritical);

  const alert = await HomeAlert.create({
    source: HomeAlertSource.IOT_EVENT,
    sourceId: event._id,
    homeId: device.homeId,
    organizationId: device.organizationId,
    deviceId: device._id,
    severity,
    title: override?.title ?? formatAlertTitle(event.eventType, device.name),
    message: override?.message ?? formatAlertMessage(event),
    recommendedActions,
    safetyDisclaimer: isSafetyEvent(event.eventType) ? SAFETY_DISCLAIMER : undefined,
    status: HomeAlertStatus.ACTIVE,
    dedupeKey,
  });

  const alertsEnabled = await evaluateFlag(FeatureFlagKey.ENABLE_IOT_ALERTS, device.customerId.toString());
  if (alertsEnabled) {
    await createNotification({
      userId: device.customerId.toString(),
      type: isCritical ? 'IOT_CRITICAL_ALERT' : 'IOT_ALERT',
      title: alert.title,
      body: alert.message,
      data: {
        alertId: alert._id.toString(),
        homeId: device.homeId.toString(),
        deviceId: device._id.toString(),
        severity: alert.severity,
      },
    });
  }

  return alert;
}

function formatAlertTitle(eventType: string, deviceName: string) {
  if (eventType.includes('LEAK')) return `Possible leak detected — ${deviceName}`;
  if (eventType.includes('SMOKE')) return `Smoke/fire signal — ${deviceName}`;
  return `Device alert — ${deviceName}`;
}

function formatAlertMessage(event: InstanceType<typeof IoTEvent>) {
  const detail = event.payload.message ?? event.payload.detail;
  return detail ? String(detail) : `Event ${event.eventType} at ${event.occurredAt.toISOString()}`;
}

function isSafetyEvent(eventType: string) {
  const t = eventType.toUpperCase();
  return t.includes('SMOKE') || t.includes('FIRE') || t.includes('GAS') || t.includes('ELECTRICAL');
}

function buildRecommendedActions(eventType: string, critical: boolean) {
  const actions = ['I am safe', 'Dismiss false alarm'];
  if (eventType.toUpperCase().includes('LEAK')) {
    actions.unshift('Book urgent plumber');
  }
  if (critical) {
    actions.unshift('Call emergency contact');
  }
  actions.push('View device details');
  return actions;
}

export async function listAlerts(customerId: string, query?: { homeId?: string; status?: string }) {
  await assertIoTEnabled(customerId);
  const filter: Record<string, unknown> = {};
  if (query?.homeId) {
    await assertHomeCapability(customerId, query.homeId, HomeCapability.DEVICE_VIEW);
    filter.homeId = query.homeId;
  } else {
    const { Home } = await import('@/models/Home.js');
    const homes = await Home.find({ customerId, isArchived: false }).select('_id');
    filter.homeId = { $in: homes.map((h) => h._id) };
  }
  if (query?.status) filter.status = query.status;

  const alerts = await HomeAlert.find(filter).sort({ createdAt: -1 }).limit(50);
  return alerts.map(serializeAlert);
}

export async function acknowledgeAlert(customerId: string, alertId: string) {
  await assertIoTEnabled(customerId);
  const alert = await getAlertForCustomer(customerId, alertId, HomeCapability.DEVICE_ALERT_ACK);
  if (alert.status === HomeAlertStatus.ACTIVE) {
    alert.status = HomeAlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    await alert.save();
  }
  return serializeAlert(alert);
}

export async function submitAlertFeedback(
  customerId: string,
  alertId: string,
  feedback: AlertFeedbackType,
) {
  await assertIoTEnabled(customerId);
  const alert = await getAlertForCustomer(customerId, alertId, HomeCapability.DEVICE_ALERT_ACK);
  alert.feedback = feedback;
  if (feedback === AlertFeedbackType.PROBLEM_RESOLVED) {
    alert.status = HomeAlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
  } else if (feedback === AlertFeedbackType.FALSE_ALARM || feedback === AlertFeedbackType.EXPECTED_BEHAVIOR) {
    alert.status = HomeAlertStatus.DISMISSED;
    alert.resolvedAt = new Date();
  }
  await alert.save();
  return serializeAlert(alert);
}

async function getAlertForCustomer(
  customerId: string,
  alertId: string,
  capability: HomeCapability,
) {
  const alert = await HomeAlert.findById(alertId);
  if (!alert) throw new AppError('Alert not found.', 404, ErrorCode.NOT_FOUND);
  await assertHomeCapability(customerId, alert.homeId.toString(), capability);
  return alert;
}

function serializeAlert(alert: InstanceType<typeof HomeAlert>) {
  return {
    id: alert._id.toString(),
    homeId: alert.homeId.toString(),
    deviceId: alert.deviceId?.toString(),
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    recommendedActions: alert.recommendedActions,
    safetyDisclaimer: alert.safetyDisclaimer,
    status: alert.status,
    feedback: alert.feedback,
    acknowledgedAt: alert.acknowledgedAt,
    resolvedAt: alert.resolvedAt,
    createdAt: alert.createdAt,
  };
}

function mapEventSeverityToAlert(severity: IoTEventSeverity): HomeAlertSeverity {
  switch (severity) {
    case IoTEventSeverity.CRITICAL:
      return HomeAlertSeverity.CRITICAL;
    case IoTEventSeverity.HIGH:
      return HomeAlertSeverity.HIGH;
    case IoTEventSeverity.MEDIUM:
      return HomeAlertSeverity.MEDIUM;
    default:
      return HomeAlertSeverity.LOW;
  }
}

export async function escalateUnacknowledgedAlerts() {
  const threshold = new Date(Date.now() - 15 * 60 * 1000);
  const alerts = await HomeAlert.find({
    status: HomeAlertStatus.ACTIVE,
    severity: { $in: [HomeAlertSeverity.CRITICAL, HomeAlertSeverity.HIGH] },
    createdAt: { $lte: threshold },
    escalationSentAt: { $exists: false },
  }).limit(20);

  let sent = 0;
  for (const alert of alerts) {
    const device = alert.deviceId ? await ConnectedDevice.findById(alert.deviceId) : null;
    if (!device) continue;

    await createNotification({
      userId: device.customerId.toString(),
      type: 'IOT_ALERT_ESCALATION',
      title: `Reminder: ${alert.title}`,
      body: 'Please acknowledge this alert or mark it as resolved.',
      data: { alertId: alert._id.toString() },
    });
    alert.escalationSentAt = new Date();
    await alert.save();
    sent += 1;
  }
  return sent;
}
