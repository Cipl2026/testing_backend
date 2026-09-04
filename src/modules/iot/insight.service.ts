import type { IoTInsight } from '@ghaarfix/shared-types';
import { TelemetryDailyAggregate } from '@/models/IoT.js';
import { ConnectedDevice, DeviceAssetLink } from '@/models/IoT.js';
import { assertIoTEnabled } from '@/modules/iot/connection.service.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { HomeCapability } from '@ghaarfix/shared-types';
import { AssetServiceRecord } from '@/models/AssetServiceRecord.js';

export async function getHomeInsights(customerId: string, homeId: string): Promise<IoTInsight[]> {
  await assertIoTEnabled(customerId);
  await assertHomeCapability(customerId, homeId, HomeCapability.DEVICE_VIEW);

  const devices = await ConnectedDevice.find({ homeId, discoveryStatus: 'APPROVED' }).limit(20);
  const insights: IoTInsight[] = [];

  for (const device of devices) {
    const link = await DeviceAssetLink.findOne({ connectedDeviceId: device._id });
    const assetId = link?.assetId?.toString();

    if (device.deviceType === 'TEMPERATURE_SENSOR' || device.deviceType === 'HVAC_CONTROLLER') {
      const trend = await TelemetryDailyAggregate.findOne({
        deviceId: device._id,
        metric: 'temperature',
      }).sort({ dayStart: -1 });

      if (trend && trend.avg > 30) {
        insights.push({
          id: `hvac-${device._id}`,
          homeId,
          deviceId: device._id.toString(),
          assetId,
          signal: 'HVAC Efficiency',
          possibleReason: 'Temperature readings suggest reduced cooling efficiency.',
          confidence: 0.65,
          recommendedAction: 'Consider scheduling an AC inspection.',
          source: 'CONNECTED_DEVICE_SIGNAL',
        });
      }
    }

    if (device.deviceType === 'HUMIDITY_SENSOR') {
      const trend = await TelemetryDailyAggregate.findOne({
        deviceId: device._id,
        metric: 'humidity',
      }).sort({ dayStart: -1 });

      if (trend && trend.max > 75) {
        insights.push({
          id: `humidity-${device._id}`,
          homeId,
          deviceId: device._id.toString(),
          assetId,
          signal: 'Humidity Risk',
          possibleReason: 'Sustained high humidity may increase mold risk.',
          confidence: 0.7,
          recommendedAction: 'Inspect ventilation or consider a dehumidifier service.',
          source: 'CONNECTED_DEVICE_SIGNAL',
        });
      }
    }

    if (assetId) {
      const repairs = await AssetServiceRecord.countDocuments({ assetId, serviceType: 'REPAIR' });
      if (repairs >= 2) {
        insights.push({
          id: `repair-${assetId}`,
          homeId,
          assetId,
          deviceId: device._id.toString(),
          signal: 'Repeated Repair Pattern',
          possibleReason: 'Linked asset has multiple repair records combined with device monitoring.',
          confidence: 0.6,
          recommendedAction: 'Review replacement options in marketplace.',
          source: 'PREDICTIVE_MAINTENANCE',
        });
      }
    }
  }

  return insights;
}
