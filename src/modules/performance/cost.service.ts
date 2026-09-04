import mongoose from 'mongoose';
import { CostUsageSnapshot } from '@/models/Performance.js';
import { env } from '@/config/env.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';

export async function captureCostSnapshot(): Promise<void> {
  const db = mongoose.connection.db;
  let databaseUsageMb = 0;
  if (db) {
    const stats = await db.stats();
    databaseUsageMb = Math.round((stats.dataSize ?? 0) / 1024 / 1024);
  }

  let queueJobsProcessed = 0;
  if (isQueueEnabled()) {
    const stats = await getQueueStats();
    queueJobsProcessed = stats.reduce((s, q) => s + q.completed, 0);
  }

  const now = new Date();
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const previous = await CostUsageSnapshot.findOne().sort({ createdAt: -1 });
  const storageGrowth = previous
    ? databaseUsageMb - (previous.databaseUsageMb ?? 0)
    : 0;

  await CostUsageSnapshot.create({
    environment: env.nodeEnv,
    periodStart,
    periodEnd: now,
    databaseUsageMb,
    storageUsageMb: databaseUsageMb,
    bandwidthMb: 0,
    queueJobsProcessed,
    notificationCount: 0,
    aiRequestCount: 0,
    externalApiCalls: 0,
    allocation: {
      database: databaseUsageMb,
      storage: databaseUsageMb,
      queue: queueJobsProcessed,
    },
  });

  if (storageGrowth > 500) {
    const { metricsService } = await import('@/modules/reliability/metrics.service.js');
    metricsService.counter('cost_anomaly_storage_growth', 1);
  }
}

export async function getLatestCostSnapshot() {
  return CostUsageSnapshot.findOne().sort({ createdAt: -1 });
}

export async function listCostSnapshots(limit = 30) {
  return CostUsageSnapshot.find().sort({ createdAt: -1 }).limit(limit);
}

export async function detectCostAnomalies(): Promise<string[]> {
  const snapshots = await CostUsageSnapshot.find().sort({ createdAt: -1 }).limit(7);
  const anomalies: string[] = [];
  if (snapshots.length < 2) return anomalies;

  const latest = snapshots[0];
  const previous = snapshots[1];
  const dbGrowth = (latest.databaseUsageMb ?? 0) - (previous.databaseUsageMb ?? 0);
  if (dbGrowth > 200) {
    anomalies.push(`Database storage grew ${dbGrowth}MB in last period`);
  }
  const notifSpike =
    (latest.notificationCount ?? 0) > (previous.notificationCount ?? 0) * 3 &&
    (latest.notificationCount ?? 0) > 1000;
  if (notifSpike) {
    anomalies.push('Notification volume spike detected');
  }
  return anomalies;
}
