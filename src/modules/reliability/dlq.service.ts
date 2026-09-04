import { DlqJobStatus } from '@ghaarfix/shared-types';
import { DeadLetterJob } from '@/models/Reliability.js';
import { sanitizeDlqPayload } from '@/modules/reliability/log-redaction.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const DESTRUCTIVE_JOB_PATTERNS = [/delete/i, /purge/i, /wipe/i, /drop/i];

export async function recordDeadLetterJob(input: {
  queueName: string;
  jobId: string;
  jobName: string;
  payload: Record<string, unknown>;
  error: string;
  attempts: number;
  traceContext?: { requestId?: string; traceId?: string };
}): Promise<void> {
  const now = new Date();
  await DeadLetterJob.findOneAndUpdate(
    { queueName: input.queueName, jobId: input.jobId },
    {
      $set: {
        jobName: input.jobName,
        payload: input.payload,
        sanitizedPayload: sanitizeDlqPayload(input.payload),
        error: input.error,
        attempts: input.attempts,
        status: DlqJobStatus.DEAD_LETTER,
        traceContext: input.traceContext,
        lastFailedAt: now,
      },
      $setOnInsert: { firstFailedAt: now },
    },
    { upsert: true },
  );
  metricsService.counter('dlq_jobs_total', 1, { queue: input.queueName });
}

export async function listDeadLetterJobs(limit = 50, status?: DlqJobStatus) {
  const query = status ? { status } : {};
  const rows = await DeadLetterJob.find(query).sort({ lastFailedAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    queueName: r.queueName,
    jobId: r.jobId,
    jobName: r.jobName,
    error: r.error,
    attempts: r.attempts,
    status: r.status,
    traceContext: r.traceContext,
    sanitizedPayload: r.sanitizedPayload,
    firstFailedAt: r.firstFailedAt,
    lastFailedAt: r.lastFailedAt,
    discardedAt: r.discardedAt,
    discardReason: r.discardReason,
  }));
}

export async function retryDeadLetterJob(id: string, actorId: string): Promise<{ retried: boolean }> {
  const job = await DeadLetterJob.findById(id);
  if (!job) throw new AppError('DLQ job not found', 404, ErrorCode.NOT_FOUND);
  if (job.status === DlqJobStatus.DISCARDED) {
    throw new AppError('Cannot retry discarded job', 409, ErrorCode.CONFLICT);
  }
  if (DESTRUCTIVE_JOB_PATTERNS.some((p) => p.test(job.jobName))) {
    throw new AppError(
      'Destructive jobs require manual review before retry',
      403,
      ErrorCode.FORBIDDEN,
    );
  }

  job.status = DlqJobStatus.PENDING_RETRY;
  job.retriedAt = new Date();
  await job.save();

  metricsService.counter('dlq_retry_total', 1, { queue: job.queueName });
  metricsService.recordBusinessEvent('dlq_retry', { actorId, queue: job.queueName });

  return { retried: true };
}

export async function discardDeadLetterJob(
  id: string,
  reason: string,
): Promise<{ discarded: boolean }> {
  const job = await DeadLetterJob.findById(id);
  if (!job) throw new AppError('DLQ job not found', 404, ErrorCode.NOT_FOUND);

  job.status = DlqJobStatus.DISCARDED;
  job.discardedAt = new Date();
  job.discardReason = reason;
  await job.save();

  metricsService.counter('dlq_discarded_total', 1, { queue: job.queueName });
  return { discarded: true };
}

export async function getDlqStats() {
  const [total, deadLetter, pendingRetry, discarded] = await Promise.all([
    DeadLetterJob.countDocuments(),
    DeadLetterJob.countDocuments({ status: DlqJobStatus.DEAD_LETTER }),
    DeadLetterJob.countDocuments({ status: DlqJobStatus.PENDING_RETRY }),
    DeadLetterJob.countDocuments({ status: DlqJobStatus.DISCARDED }),
  ]);
  return { total, deadLetter, pendingRetry, discarded };
}
