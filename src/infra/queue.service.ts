import type { Queue, Worker } from 'bullmq';
import { QueueName, QueueJobStatus } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { getRedisClient, isRedisEnabled } from '@/infra/redis.js';
import { QueueJobFailure } from '@/models/QueueJobFailure.js';
import { recordDeadLetterJob } from '@/modules/reliability/dlq.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { logger } from '@/utils/logger.js';

type JobHandler = (data: Record<string, unknown>) => Promise<void>;

interface QueueBundle {
  queue: Queue;
  worker: Worker;
}

const bundles = new Map<QueueName, QueueBundle>();
let initialized = false;

const QUEUE_PRIORITIES: Record<QueueName, number> = {
  [QueueName.URGENT_MATCHING]: 1,
  [QueueName.IOT_EVENTS]: 2,
  [QueueName.NOTIFICATIONS]: 3,
  [QueueName.MAINTENANCE]: 4,
  [QueueName.ANALYTICS]: 5,
  [QueueName.CAMPAIGNS]: 6,
  [QueueName.CLEANUP]: 7,
};

async function recordFailure(
  queueName: QueueName,
  jobId: string,
  jobName: string,
  payload: Record<string, unknown>,
  error: unknown,
  attempts: number,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  await QueueJobFailure.findOneAndUpdate(
    { queueName, jobId },
    {
      $set: {
        jobName,
        payload,
        error: errorMessage,
        attempts,
        status: QueueJobStatus.DEAD_LETTER,
        failedAt: new Date(),
      },
    },
    { upsert: true },
  );
  await recordDeadLetterJob({
    queueName,
    jobId,
    jobName,
    payload,
    error: errorMessage,
    attempts,
    traceContext: payload.traceContext as { requestId?: string; traceId?: string } | undefined,
  });
  metricsService.counter('queue_job_failed_total', 1, { queue: queueName });
}

export async function initQueues(handlers: Partial<Record<QueueName, JobHandler>>): Promise<void> {
  if (initialized || !isRedisEnabled()) return;
  const redis = await getRedisClient();
  if (!redis) return;

  const { Queue, Worker } = await import('bullmq');
  const connection = { connection: redis };

  for (const queueName of Object.values(QueueName)) {
    const queue = new Queue(queueName, connection);
    const handler = handlers[queueName];
    if (!handler) continue;

    const worker = new Worker(
      queueName,
      async (job) => {
        await handler((job.data ?? {}) as Record<string, unknown>);
      },
      {
        ...connection,
        concurrency: env.queue.concurrency,
      },
    );

    worker.on('failed', (job, error) => {
      if (!job) return;
      void recordFailure(
        queueName,
        job.id ?? 'unknown',
        job.name,
        (job.data ?? {}) as Record<string, unknown>,
        error,
        job.attemptsMade,
      );
    });

    bundles.set(queueName, { queue, worker });
  }

  initialized = true;
  logger.info('BullMQ queues initialized', { queues: [...bundles.keys()] });
}

export async function enqueueJob(
  queueName: QueueName,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { priority?: number; delayMs?: number; jobId?: string },
): Promise<string | null> {
  if (!isRedisEnabled()) return null;
  const bundle = bundles.get(queueName);
  if (!bundle) return null;
  const job = await bundle.queue.add(jobName, data, {
    jobId: opts?.jobId,
    priority: opts?.priority ?? QUEUE_PRIORITIES[queueName],
    delay: opts?.delayMs,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: false,
  });
  return job.id ?? null;
}

export async function cancelQueuedJob(queueName: QueueName, jobId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  const bundle = bundles.get(queueName);
  if (!bundle) return;
  const job = await bundle.queue.getJob(jobId);
  if (job) await job.remove();
}

export async function getQueueStats(): Promise<
  Array<{ name: QueueName; waiting: number; active: number; completed: number; failed: number }>
> {
  if (!isRedisEnabled()) return [];
  const stats: Array<{
    name: QueueName;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> = [];

  for (const [name, bundle] of bundles) {
    const counts = await bundle.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
    );
    stats.push({
      name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    });
  }
  return stats;
}

export async function closeQueues(): Promise<void> {
  for (const bundle of bundles.values()) {
    await bundle.worker.close();
    await bundle.queue.close();
  }
  bundles.clear();
  initialized = false;
}

export function isQueueEnabled(): boolean {
  return isRedisEnabled() && bundles.size > 0;
}
