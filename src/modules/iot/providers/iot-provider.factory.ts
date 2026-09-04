import { IoTProviderType } from '@ghaarfix/shared-types';
import type { IoTProvider } from '@/modules/iot/providers/iot-provider.interface.js';
import {
  GenericWebhookIoTProvider,
  MatterProviderAdapter,
  SmartHomeProviderAdapter,
} from '@/modules/iot/providers/generic-webhook.provider.js';

const providers: Record<IoTProviderType, IoTProvider> = {
  [IoTProviderType.GENERIC_WEBHOOK]: new GenericWebhookIoTProvider(),
  [IoTProviderType.SMART_HOME_PROVIDER]: new SmartHomeProviderAdapter(),
  [IoTProviderType.MATTER]: new MatterProviderAdapter(),
};

export function getIoTProvider(type: IoTProviderType): IoTProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Unsupported IoT provider: ${type}`);
  return provider;
}
