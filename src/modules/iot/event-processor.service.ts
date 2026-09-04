import {
  IoTEventSeverity,
  IoTEventStatus,
  IoTRuleActionType,
  IoTRuleScope,
  type IoTRuleCondition,
} from '@ghaarfix/shared-types';
import { ConnectedDevice, IoTEvent, IoTRule } from '@/models/IoT.js';
import { createAlertFromEvent } from '@/modules/iot/alert.service.js';
import { storeTelemetry } from '@/modules/iot/telemetry.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';

export async function processIoTEvent(eventId: string) {
  const event = await IoTEvent.findById(eventId);
  if (!event || event.status !== IoTEventStatus.NEW) return { processed: false };

  const device = await ConnectedDevice.findById(event.deviceId);
  if (!device) return { processed: false };

  if (typeof event.payload.value === 'number' && typeof event.payload.metric === 'string') {
    await storeTelemetry({
      deviceId: device._id.toString(),
      metric: String(event.payload.metric),
      value: Number(event.payload.value),
      unit: event.payload.unit ? String(event.payload.unit) : undefined,
      timestamp: event.occurredAt,
    });
  }

  const rules = await IoTRule.find({
    enabled: true,
    $or: [
      { scope: IoTRuleScope.GLOBAL_TEMPLATE },
      ...(device.homeId ? [{ scope: IoTRuleScope.HOME, homeId: device.homeId }] : []),
      ...(device.organizationId
        ? [{ scope: IoTRuleScope.ORGANIZATION, organizationId: device.organizationId }]
        : []),
    ],
  }).sort({ priority: 1 });

  for (const rule of rules) {
    if (evaluateCondition(rule.conditions, event, device)) {
      await executeRuleActions(rule, event, device);
    }
  }

  if (
    event.severity === IoTEventSeverity.CRITICAL ||
    event.severity === IoTEventSeverity.HIGH
  ) {
    await createAlertFromEvent(event, device);
  }

  event.status = IoTEventStatus.ACKNOWLEDGED;
  await event.save();

  return { processed: true };
}

function evaluateCondition(
  condition: IoTRuleCondition,
  event: InstanceType<typeof IoTEvent>,
  device: InstanceType<typeof ConnectedDevice>,
): boolean {
  if (condition.type === 'COMPOUND' && condition.children?.length) {
    const results = condition.children.map((c) => evaluateCondition(c, event, device));
    return condition.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }

  if (condition.type === 'EVENT_TYPE') {
    return event.eventType === condition.eventType;
  }

  if (condition.type === 'DEVICE_STATUS') {
    return device.status === condition.deviceStatus;
  }

  if (condition.type === 'METRIC_THRESHOLD') {
    const value = Number(event.payload.value ?? event.payload[condition.metric ?? '']);
    const threshold = Number(condition.value);
    if (Number.isNaN(value) || Number.isNaN(threshold)) return false;
    switch (condition.operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  return false;
}

async function executeRuleActions(
  rule: InstanceType<typeof IoTRule>,
  event: InstanceType<typeof IoTEvent>,
  device: InstanceType<typeof ConnectedDevice>,
) {
  for (const action of rule.actions) {
    switch (action.type) {
      case IoTRuleActionType.SEND_NOTIFICATION:
      case IoTRuleActionType.CREATE_ALERT:
        await createAlertFromEvent(event, device, {
          title: String(action.config?.title ?? rule.name),
          message: String(action.config?.message ?? `Rule triggered: ${rule.name}`),
        });
        break;
      case IoTRuleActionType.SUGGEST_SERVICE:
      case IoTRuleActionType.CREATE_URGENT_DRAFT:
        if (device.homeId) {
          await createNotification({
            userId: device.customerId.toString(),
            type: 'IOT_SERVICE_SUGGESTION',
            title: 'Service recommended',
            body: `Based on your ${device.name}, we suggest scheduling a service. No booking was created automatically.`,
            data: { deviceId: device._id.toString(), eventId: event._id.toString(), draftOnly: true },
          });
        }
        break;
      case IoTRuleActionType.CREATE_INSIGHT:
        break;
      case IoTRuleActionType.NOTIFY_ORGANIZATION:
        if (device.organizationId) {
          await createNotification({
            userId: device.customerId.toString(),
            type: 'IOT_ORG_ALERT',
            title: 'Property device alert',
            body: `${device.name}: ${event.eventType}`,
            data: { organizationId: device.organizationId.toString(), deviceId: device._id.toString() },
          });
        }
        break;
      default:
        break;
    }
  }
}
