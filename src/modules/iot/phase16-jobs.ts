import { refreshDeviceHealth } from '@/modules/iot/device-health.service.js';
import { escalateUnacknowledgedAlerts } from '@/modules/iot/alert.service.js';
import { expireStaleSignalAccess } from '@/modules/iot/service-signal-access.service.js';
import {
  aggregateDailyTelemetry,
  aggregateHourlyTelemetry,
  cleanupStaleTelemetry,
} from '@/modules/iot/telemetry.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase16Jobs() {
  const [health, escalation, signalCleanup, hourly, daily, telemetryCleanup] = await Promise.all([
    refreshDeviceHealth().catch((e) => {
      logger.error('Phase16 device health failed', { error: e });
      return 0;
    }),
    escalateUnacknowledgedAlerts().catch((e) => {
      logger.error('Phase16 alert escalation failed', { error: e });
      return 0;
    }),
    expireStaleSignalAccess().catch((e) => {
      logger.error('Phase16 signal access cleanup failed', { error: e });
      return 0;
    }),
    aggregateHourlyTelemetry().catch((e) => {
      logger.error('Phase16 hourly telemetry failed', { error: e });
      return { upserted: 0 };
    }),
    aggregateDailyTelemetry().catch((e) => {
      logger.error('Phase16 daily telemetry failed', { error: e });
      return { upserted: 0 };
    }),
    cleanupStaleTelemetry().catch((e) => {
      logger.error('Phase16 telemetry cleanup failed', { error: e });
      return 0;
    }),
  ]);

  return {
    health,
    escalation,
    signalCleanup,
    hourlyAggregates: hourly.upserted,
    dailyAggregates: daily.upserted,
    telemetryCleanup,
  };
}
