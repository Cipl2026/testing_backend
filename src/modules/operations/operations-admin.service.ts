import mongoose from 'mongoose';
import { QueueJobFailure } from '@/models/QueueJobFailure.js';
import { ZoneDemandMetric } from '@/models/ZoneDemandMetric.js';
import { ServiceWaitlist } from '@/models/ServiceWaitlist.js';
import { ProviderCapacity } from '@/models/ProviderCapacity.js';
import { isRedisEnabled, pingRedis } from '@/infra/redis.js';
import { getQueueStats, isQueueEnabled } from '@/infra/queue.service.js';
import { WaitlistStatus } from '@ghaarfix/shared-types';

export async function getSystemHealth() {
  const [mongoOk, redisOk] = await Promise.all([
    mongoose.connection.readyState === 1
      ? mongoose.connection.db!.admin().ping().then(() => true).catch(() => false)
      : Promise.resolve(false),
    isRedisEnabled() ? pingRedis() : Promise.resolve(null),
  ]);

  return {
    mongo: mongoOk ? 'up' : 'down',
    redis: redisOk === null ? 'disabled' : redisOk ? 'up' : 'down',
    queues: isQueueEnabled() ? 'enabled' : 'fallback',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function getQueueAdminStats() {
  const [stats, dlqCount] = await Promise.all([
    getQueueStats(),
    QueueJobFailure.countDocuments(),
  ]);
  return { queues: stats, deadLetterCount: dlqCount };
}

export async function getZoneDemandMetrics(serviceZoneId?: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = since.toISOString().slice(0, 10);
  const query: Record<string, unknown> = { date: { $gte: dateStr } };
  if (serviceZoneId) query.serviceZoneId = serviceZoneId;
  const metrics = await ZoneDemandMetric.find(query).sort({ date: -1, hour: -1 }).limit(500);
  return metrics.map((m) => ({
    serviceZoneId: m.serviceZoneId.toString(),
    serviceId: m.serviceId?.toString(),
    date: m.date,
    hour: m.hour,
    requestCount: m.requestCount,
    waitlistCount: m.waitlistCount,
    bookingCount: m.bookingCount,
  }));
}

export async function getWaitlistAdminSummary() {
  const [pending, matched, expired] = await Promise.all([
    ServiceWaitlist.countDocuments({ status: WaitlistStatus.PENDING }),
    ServiceWaitlist.countDocuments({ status: WaitlistStatus.MATCHED }),
    ServiceWaitlist.countDocuments({ status: WaitlistStatus.EXPIRED }),
  ]);
  return { pending, matched, expired };
}

export async function listProviderCapacityAdmin(date?: string) {
  const query = date ? { date } : {};
  const rows = await ProviderCapacity.find(query).sort({ bookedCount: -1 }).limit(100);
  return rows.map((r) => ({
    providerId: r.providerId.toString(),
    date: r.date,
    bookedCount: r.bookedCount,
    maxDailyJobs: r.maxDailyJobs,
    status: r.status,
  }));
}

export async function listDlqEntries(limit = 50) {
  const rows = await QueueJobFailure.find().sort({ failedAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    queueName: r.queueName,
    jobId: r.jobId,
    jobName: r.jobName,
    error: r.error,
    attempts: r.attempts,
    failedAt: r.failedAt,
  }));
}
