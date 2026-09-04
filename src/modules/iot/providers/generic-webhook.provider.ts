import crypto from 'node:crypto';
import {
  ConnectedDeviceType,
  IoTEventSeverity,
  IoTProviderType,
  type NormalizedIoTEvent,
} from '@ghaarfix/shared-types';
import type { DiscoveredDevice, IoTProvider } from '@/modules/iot/providers/iot-provider.interface.js';

function mapSeverity(value: unknown): IoTEventSeverity {
  const s = String(value ?? 'INFO').toUpperCase();
  if (s in IoTEventSeverity) return s as IoTEventSeverity;
  if (s === 'CRITICAL') return IoTEventSeverity.CRITICAL;
  if (s === 'HIGH') return IoTEventSeverity.HIGH;
  return IoTEventSeverity.INFO;
}

function normalizeWebhookEvent(
  payload: Record<string, unknown>,
  context: { connectionId: string },
): NormalizedIoTEvent {
  const deviceExternalId = String(payload.deviceId ?? payload.externalDeviceId ?? 'unknown');
  const eventType = String(payload.eventType ?? payload.type ?? 'UNKNOWN');
  const severity = mapSeverity(payload.severity);
  const occurredAt = payload.occurredAt ? new Date(String(payload.occurredAt)) : new Date();

  const dedupeKey =
    String(payload.eventId ?? payload.id) ||
    crypto
      .createHash('sha256')
      .update(`${context.connectionId}:${deviceExternalId}:${eventType}:${occurredAt.toISOString()}`)
      .digest('hex');

  return {
    externalEventId: payload.eventId ? String(payload.eventId) : undefined,
    deviceExternalId,
    eventType,
    severity,
    payload,
    occurredAt,
    dedupeKey,
  };
}

export class GenericWebhookIoTProvider implements IoTProvider {
  readonly type = IoTProviderType.GENERIC_WEBHOOK;

  async connectAccount(input: { customerId: string; homeId?: string }) {
    const connectionId = `wh_${input.customerId}_${Date.now()}`;
    return { connectionId, status: 'CONNECTED', authUrl: undefined };
  }

  async disconnectAccount() {
    return;
  }

  async listDevices(): Promise<DiscoveredDevice[]> {
    return [];
  }

  async getDeviceState() {
    return {};
  }

  async subscribe() {
    return;
  }

  async unsubscribe() {
    return;
  }

  normalizeEvent(payload: Record<string, unknown>, context: { connectionId: string }) {
    return normalizeWebhookEvent(payload, context);
  }
}

export class SmartHomeProviderAdapter implements IoTProvider {
  readonly type = IoTProviderType.SMART_HOME_PROVIDER;
  private base = new GenericWebhookIoTProvider();

  connectAccount = this.base.connectAccount.bind(this.base);
  disconnectAccount = this.base.disconnectAccount.bind(this.base);
  getDeviceState = this.base.getDeviceState.bind(this.base);
  subscribe = this.base.subscribe.bind(this.base);
  unsubscribe = this.base.unsubscribe.bind(this.base);
  normalizeEvent = this.base.normalizeEvent.bind(this.base);

  async listDevices(): Promise<DiscoveredDevice[]> {
    return [
      {
        externalDeviceId: 'demo-leak-sensor-1',
        name: 'Kitchen Leak Sensor',
        deviceType: ConnectedDeviceType.LEAK_SENSOR,
        manufacturer: 'Demo',
        capabilities: ['leak_detection', 'battery'],
      },
      {
        externalDeviceId: 'demo-temp-sensor-1',
        name: 'Living Room Temperature',
        deviceType: ConnectedDeviceType.TEMPERATURE_SENSOR,
        manufacturer: 'Demo',
        capabilities: ['temperature'],
      },
    ];
  }
}

export class MatterProviderAdapter implements IoTProvider {
  readonly type = IoTProviderType.MATTER;
  private base = new GenericWebhookIoTProvider();

  connectAccount = this.base.connectAccount.bind(this.base);
  disconnectAccount = this.base.disconnectAccount.bind(this.base);
  listDevices = this.base.listDevices.bind(this.base);
  getDeviceState = this.base.getDeviceState.bind(this.base);
  subscribe = this.base.subscribe.bind(this.base);
  unsubscribe = this.base.unsubscribe.bind(this.base);
  normalizeEvent = this.base.normalizeEvent.bind(this.base);
}
