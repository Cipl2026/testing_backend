import {
  TelemetryDailyAggregate,
  TelemetryHourlyAggregate,
  TelemetryPoint,
} from '@/models/IoT.js';

/** Raw telemetry: 7-day TTL via MongoDB TTL index on TelemetryPoint.timestamp */
const RAW_RETENTION_DAYS = 7;
/** Hourly aggregates: 90-day TTL */
const HOURLY_RETENTION_DAYS = 90;

export async function storeTelemetry(input: {
  deviceId: string;
  metric: string;
  value: number;
  unit?: string;
  timestamp?: Date;
}) {
  const timestamp = input.timestamp ?? new Date();
  await TelemetryPoint.create({
    deviceId: input.deviceId,
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    timestamp,
  });
  return { stored: true, retentionDays: RAW_RETENTION_DAYS };
}

export async function getRecentTelemetry(deviceId: string, metric: string, limit = 50) {
  const points = await TelemetryPoint.find({ deviceId, metric })
    .sort({ timestamp: -1 })
    .limit(limit);
  return points.map((p) => ({
    value: p.value,
    unit: p.unit,
    timestamp: p.timestamp,
  }));
}

export async function aggregateHourlyTelemetry(since?: Date) {
  const windowStart = since ?? new Date(Date.now() - 2 * 60 * 60 * 1000);
  const pipeline = [
    { $match: { timestamp: { $gte: windowStart } } },
    {
      $group: {
        _id: {
          deviceId: '$deviceId',
          metric: '$metric',
          hour: { $dateTrunc: { date: '$timestamp', unit: 'hour' } },
        },
        avg: { $avg: '$value' },
        max: { $max: '$value' },
        min: { $min: '$value' },
        count: { $sum: 1 },
      },
    },
  ];

  const results = await TelemetryPoint.aggregate(pipeline);
  let upserted = 0;

  for (const row of results) {
    await TelemetryHourlyAggregate.findOneAndUpdate(
      {
        deviceId: row._id.deviceId,
        metric: row._id.metric,
        hourStart: row._id.hour,
      },
      {
        avg: row.avg,
        max: row.max,
        min: row.min,
        count: row.count,
      },
      { upsert: true },
    );
    upserted += 1;
  }

  return { upserted, retentionDays: HOURLY_RETENTION_DAYS };
}

export async function aggregateDailyTelemetry(day?: Date) {
  const dayStart = day ?? new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const pipeline = [
    { $match: { hourStart: { $gte: dayStart, $lt: dayEnd } } },
    {
      $group: {
        _id: { deviceId: '$deviceId', metric: '$metric' },
        avg: { $avg: '$avg' },
        max: { $max: '$max' },
        min: { $min: '$min' },
        count: { $sum: '$count' },
      },
    },
  ];

  const results = await TelemetryHourlyAggregate.aggregate(pipeline);
  let upserted = 0;

  for (const row of results) {
    await TelemetryDailyAggregate.findOneAndUpdate(
      { deviceId: row._id.deviceId, metric: row._id.metric, dayStart },
      { avg: row.avg, max: row.max, min: row.min, count: row.count },
      { upsert: true },
    );
    upserted += 1;
  }

  return { upserted };
}

export async function cleanupStaleTelemetry() {
  const cutoff = new Date(Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await TelemetryPoint.deleteMany({ timestamp: { $lt: cutoff } });
  return deleted.deletedCount ?? 0;
}
