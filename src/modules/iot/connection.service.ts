import crypto from 'node:crypto';
import { ErrorCode, FeatureFlagKey, HomeCapability, IoTConnectionStatus, IoTProviderType } from '@ghaarfix/shared-types';
import { IoTIntegrationConnection } from '@/models/IoT.js';
import { getIoTProvider } from '@/modules/iot/providers/iot-provider.factory.js';
import { evaluateFlag } from '@/modules/discovery-growth/feature-flag.service.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';

export async function assertIoTEnabled(customerId: string) {
  const enabled = await evaluateFlag(FeatureFlagKey.ENABLE_IOT, customerId);
  if (!enabled) {
    throw new AppError('Connected home is not enabled for your account.', 403, ErrorCode.FORBIDDEN);
  }
}

export async function listConnections(customerId: string) {
  await assertIoTEnabled(customerId);
  const items = await IoTIntegrationConnection.find({
    customerId,
    status: { $ne: IoTConnectionStatus.DISCONNECTED },
  }).sort({ createdAt: -1 });

  return items.map((c) => ({
    id: c._id.toString(),
    provider: c.provider,
    status: c.status,
    homeId: c.homeId?.toString(),
    lastSyncAt: c.lastSyncAt,
    createdAt: c.createdAt,
  }));
}

export async function connectProvider(
  customerId: string,
  providerType: IoTProviderType,
  input: { homeId?: string; redirectUrl?: string },
) {
  await assertIoTEnabled(customerId);
  if (input.homeId) {
    await assertHomeCapability(customerId, input.homeId, HomeCapability.DEVICE_MANAGE);
  }

  const provider = getIoTProvider(providerType);
  const webhookSecret = crypto.randomBytes(32).toString('hex');
  const result = await provider.connectAccount({
    customerId,
    homeId: input.homeId,
    redirectUrl: input.redirectUrl,
  });

  const connection = await IoTIntegrationConnection.create({
    customerId,
    homeId: input.homeId,
    provider: providerType,
    status: IoTConnectionStatus.CONNECTED,
    externalAccountId: result.connectionId,
    webhookSecret,
  });

  return {
    connectionId: connection._id.toString(),
    provider: providerType,
    status: connection.status,
    authUrl: result.authUrl,
    webhookSecret,
  };
}

export async function disconnectConnection(customerId: string, connectionId: string) {
  await assertIoTEnabled(customerId);
  const connection = await IoTIntegrationConnection.findOne({ _id: connectionId, customerId });
  if (!connection) throw new AppError('Connection not found.', 404, ErrorCode.NOT_FOUND);

  const provider = getIoTProvider(connection.provider);
  await provider.disconnectAccount(connection._id.toString());

  connection.status = IoTConnectionStatus.DISCONNECTED;
  await connection.save();

  const { ConnectedDevice } = await import('@/models/IoT.js');
  const { ConnectedDeviceStatus } = await import('@ghaarfix/shared-types');
  await ConnectedDevice.updateMany(
    { connectionId: connection._id },
    { status: ConnectedDeviceStatus.REMOVED },
  );

  return { id: connection._id.toString(), status: connection.status };
}

export async function getConnectionById(connectionId: string) {
  const connection = await IoTIntegrationConnection.findById(connectionId);
  if (!connection || connection.status === IoTConnectionStatus.DISCONNECTED) {
    throw new AppError('Connection not found.', 404, ErrorCode.NOT_FOUND);
  }
  return connection;
}
