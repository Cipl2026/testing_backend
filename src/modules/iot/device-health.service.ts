import { ConnectedDeviceStatus, DeviceHealthLevel } from '@ghaarfix/shared-types';
import { ConnectedDevice, DeviceHealthStatus } from '@/models/IoT.js';

const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

export async function refreshDeviceHealth() {
  const devices = await ConnectedDevice.find({
    status: { $ne: ConnectedDeviceStatus.REMOVED },
    discoveryStatus: 'APPROVED',
  }).limit(200);

  let updated = 0;
  const now = Date.now();

  for (const device of devices) {
    const lastSeen = device.lastSeenAt?.getTime() ?? 0;
    const offline = now - lastSeen > OFFLINE_THRESHOLD_MS;

    let healthStatus = DeviceHealthLevel.HEALTHY;
    let connectivityScore = 100;

    if (device.status === ConnectedDeviceStatus.ERROR) {
      healthStatus = DeviceHealthLevel.DEGRADED;
      connectivityScore = 40;
    } else if (offline || device.status === ConnectedDeviceStatus.OFFLINE) {
      healthStatus = DeviceHealthLevel.OFFLINE;
      connectivityScore = 0;
    } else if (!device.lastSeenAt) {
      healthStatus = DeviceHealthLevel.UNKNOWN;
      connectivityScore = 50;
    }

    await DeviceHealthStatus.findOneAndUpdate(
      { deviceId: device._id },
      {
        connectivityScore,
        dataFreshness: device.lastSeenAt,
        healthStatus,
        lastError: offline ? 'Device offline' : undefined,
      },
      { upsert: true },
    );

    if (offline && device.status === ConnectedDeviceStatus.ONLINE) {
      device.status = ConnectedDeviceStatus.OFFLINE;
      await device.save();
    }

    updated += 1;
  }

  return updated;
}
