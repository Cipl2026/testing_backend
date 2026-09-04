import {
  ConnectedDeviceStatus,
  DeviceDiscoveryStatus,
  DeviceAssetLinkRelationship,
  ErrorCode,
  HomeCapability,
  IoTConnectionStatus,
} from '@ghaarfix/shared-types';
import {
  ConnectedDevice,
  DeviceAssetLink,
  DeviceHealthStatus,
  IoTIntegrationConnection,
} from '@/models/IoT.js';
import { assertIoTEnabled } from '@/modules/iot/connection.service.js';
import { getIoTProvider } from '@/modules/iot/providers/iot-provider.factory.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { getOwnedAsset } from '@/modules/home-health/helpers.js';
import { AppError } from '@/utils/AppError.js';

export async function listDevices(customerId: string, query?: { homeId?: string }) {
  await assertIoTEnabled(customerId);
  const filter: Record<string, unknown> = {
    customerId,
    status: { $ne: ConnectedDeviceStatus.REMOVED },
    discoveryStatus: DeviceDiscoveryStatus.APPROVED,
  };
  if (query?.homeId) {
    await assertHomeCapability(customerId, query.homeId, HomeCapability.DEVICE_VIEW);
    filter.homeId = query.homeId;
  }

  const devices = await ConnectedDevice.find(filter).sort({ name: 1 });
  return Promise.all(devices.map((d) => serializeDevice(d)));
}

export async function discoverDevices(customerId: string, connectionId: string) {
  await assertIoTEnabled(customerId);
  const connection = await IoTIntegrationConnection.findOne({
    _id: connectionId,
    customerId,
    status: IoTConnectionStatus.CONNECTED,
  });
  if (!connection) throw new AppError('Connection not found.', 404, ErrorCode.NOT_FOUND);

  const provider = getIoTProvider(connection.provider);
  const discovered = await provider.listDevices(connection._id.toString());

  const results = [];
  for (const item of discovered) {
    const existing = await ConnectedDevice.findOne({
      provider: connection.provider,
      externalDeviceId: item.externalDeviceId,
    });

    if (existing && existing.discoveryStatus === DeviceDiscoveryStatus.APPROVED) {
      results.push(await serializeDevice(existing));
      continue;
    }

    const device = await ConnectedDevice.findOneAndUpdate(
      { provider: connection.provider, externalDeviceId: item.externalDeviceId },
      {
        customerId,
        connectionId: connection._id,
        homeId: connection.homeId,
        provider: connection.provider,
        externalDeviceId: item.externalDeviceId,
        name: item.name,
        deviceType: item.deviceType,
        manufacturer: item.manufacturer,
        model: item.model,
        capabilities: item.capabilities ?? [],
        discoveryStatus: DeviceDiscoveryStatus.DISCOVERED,
        status: ConnectedDeviceStatus.UNKNOWN,
        metadata: item.metadata,
      },
      { upsert: true, new: true },
    );
    results.push(await serializeDevice(device));
  }

  connection.lastSyncAt = new Date();
  await connection.save();

  return results.filter((d) => d.discoveryStatus === DeviceDiscoveryStatus.DISCOVERED);
}

export async function approveDevice(customerId: string, deviceId: string, homeId: string) {
  await assertIoTEnabled(customerId);
  await assertHomeCapability(customerId, homeId, HomeCapability.DEVICE_MANAGE);

  const device = await ConnectedDevice.findOne({
    _id: deviceId,
    customerId,
    status: { $ne: ConnectedDeviceStatus.REMOVED },
  });
  if (!device) throw new AppError('Device not found.', 404, ErrorCode.NOT_FOUND);

  device.homeId = homeId as unknown as import('mongoose').Types.ObjectId;
  device.discoveryStatus = DeviceDiscoveryStatus.APPROVED;
  device.status = ConnectedDeviceStatus.ONLINE;
  device.lastSeenAt = new Date();
  await device.save();

  await DeviceHealthStatus.findOneAndUpdate(
    { deviceId: device._id },
    { healthStatus: 'HEALTHY', connectivityScore: 100, dataFreshness: new Date() },
    { upsert: true },
  );

  return serializeDevice(device);
}

export async function getDevice(customerId: string, deviceId: string) {
  await assertIoTEnabled(customerId);
  const device = await assertDeviceAccess(customerId, deviceId);
  return serializeDevice(device, true);
}

export async function removeDevice(customerId: string, deviceId: string) {
  await assertIoTEnabled(customerId);
  const device = await assertDeviceAccess(customerId, deviceId, HomeCapability.DEVICE_MANAGE);
  device.status = ConnectedDeviceStatus.REMOVED;
  await device.save();
  return { id: device._id.toString(), status: device.status };
}

export async function linkDeviceToAsset(
  customerId: string,
  deviceId: string,
  input: { assetId: string; relationshipType: DeviceAssetLinkRelationship },
) {
  await assertIoTEnabled(customerId);
  const device = await assertDeviceAccess(customerId, deviceId, HomeCapability.DEVICE_MANAGE);
  const asset = await getOwnedAsset(customerId, input.assetId);

  if (device.homeId && asset.homeId.toString() !== device.homeId.toString()) {
    throw new AppError('Asset must belong to the same home as the device.', 409, ErrorCode.CONFLICT);
  }

  const link = await DeviceAssetLink.findOneAndUpdate(
    { connectedDeviceId: device._id, assetId: asset._id },
    {
      relationshipType: input.relationshipType,
      confidence: 1,
      verifiedBy: customerId,
    },
    { upsert: true, new: true },
  );

  return {
    id: link._id.toString(),
    deviceId: device._id.toString(),
    assetId: asset._id.toString(),
    relationshipType: link.relationshipType,
    confidence: link.confidence,
    verified: true,
  };
}

async function assertDeviceAccess(
  customerId: string,
  deviceId: string,
  capability: HomeCapability = HomeCapability.DEVICE_VIEW,
) {
  const device = await ConnectedDevice.findOne({
    _id: deviceId,
    customerId,
    status: { $ne: ConnectedDeviceStatus.REMOVED },
  });
  if (!device) throw new AppError('Device not found.', 404, ErrorCode.NOT_FOUND);
  if (device.homeId) {
    await assertHomeCapability(customerId, device.homeId.toString(), capability);
  }
  return device;
}

async function serializeDevice(device: InstanceType<typeof ConnectedDevice>, detailed = false) {
  const health = await DeviceHealthStatus.findOne({ deviceId: device._id });
  const links = detailed
    ? await DeviceAssetLink.find({ connectedDeviceId: device._id }).limit(10)
    : [];

  return {
    id: device._id.toString(),
    homeId: device.homeId?.toString(),
    name: device.name,
    deviceType: device.deviceType,
    manufacturer: device.manufacturer,
    model: device.model,
    status: device.status,
    discoveryStatus: device.discoveryStatus,
    capabilities: device.capabilities,
    lastSeenAt: device.lastSeenAt,
    health: health
      ? {
          healthStatus: health.healthStatus,
          connectivityScore: health.connectivityScore,
          batteryStatus: health.batteryStatus,
          dataFreshness: health.dataFreshness,
        }
      : undefined,
    assetLinks: links.map((l) => ({
      assetId: l.assetId.toString(),
      relationshipType: l.relationshipType,
      confidence: l.confidence,
      verified: Boolean(l.verifiedBy),
    })),
  };
}

export async function assertDeviceOwnership(customerId: string, deviceId: string) {
  return assertDeviceAccess(customerId, deviceId);
}
