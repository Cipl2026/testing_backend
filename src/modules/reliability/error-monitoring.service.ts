import { env } from '@/config/env.js';
import { MonitoredError } from '@/models/Reliability.js';
import { buildErrorDeduplicationKey } from '@/modules/reliability/metrics.service.js';
import { normalizeStack, redactValue } from '@/modules/reliability/log-redaction.service.js';
import { getObservabilityProvider } from '@/modules/reliability/observability/provider.js';
import type { LogMeta } from '@/modules/reliability/observability/types.js';

export async function captureError(
  error: unknown,
  context: LogMeta & { errorCode?: string },
): Promise<void> {
  const errorCode = context.errorCode ?? 'INTERNAL_ERROR';
  const message =
    error instanceof Error ? redactString(error.message) : redactString(String(error));
  const stack = error instanceof Error ? normalizeStack(error.stack) : undefined;
  const deduplicationKey = buildErrorDeduplicationKey(
    errorCode,
    message,
    stack,
    env.release.version,
  );

  await MonitoredError.findOneAndUpdate(
    { deduplicationKey },
    {
      $set: {
        errorCode,
        message,
        normalizedStack: stack,
        releaseVersion: env.release.version,
        environment: env.nodeEnv,
        requestId: context.requestId,
        traceId: context.traceId,
        lastSeenAt: new Date(),
      },
      $inc: { count: 1 },
      $setOnInsert: { firstSeenAt: new Date(), deduplicationKey },
    },
    { upsert: true },
  );

  getObservabilityProvider().recordException(error, {
    ...redactValue(context) as LogMeta,
    errorCode,
  });
}

function redactString(value: string): string {
  return String(redactValue(value));
}

export async function listMonitoredErrors(limit = 50) {
  const rows = await MonitoredError.find().sort({ lastSeenAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    errorCode: r.errorCode,
    message: r.message,
    count: r.count,
    releaseVersion: r.releaseVersion,
    firstSeenAt: r.firstSeenAt,
    lastSeenAt: r.lastSeenAt,
    deduplicationKey: r.deduplicationKey,
  }));
}
