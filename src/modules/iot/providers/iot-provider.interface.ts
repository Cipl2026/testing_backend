import {
  ConnectedDeviceType,
  IoTProviderType,
  type NormalizedIoTEvent,
} from '@ghaarfix/shared-types';

export interface DiscoveredDevice {
  externalDeviceId: string;
  name: string;
  deviceType: ConnectedDeviceType;
  manufacturer?: string;
  model?: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface IoTProvider {
  readonly type: IoTProviderType;

  connectAccount(input: {
    customerId: string;
    homeId?: string;
    redirectUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ connectionId: string; authUrl?: string; status: string }>;

  disconnectAccount(connectionId: string): Promise<void>;

  listDevices(connectionId: string): Promise<DiscoveredDevice[]>;

  getDeviceState(connectionId: string, externalDeviceId: string): Promise<Record<string, unknown>>;

  subscribe(connectionId: string, externalDeviceId: string): Promise<void>;

  unsubscribe(connectionId: string, externalDeviceId: string): Promise<void>;

  normalizeEvent(
    payload: Record<string, unknown>,
    context: { connectionId: string; provider: IoTProviderType },
  ): NormalizedIoTEvent;
}
