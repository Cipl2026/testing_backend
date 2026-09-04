import mongoose from 'mongoose';
import { SecurityEvent } from '@/models/Security.js';
import {
  SecurityEventSeverity,
  SecurityEventStatus,
  SecurityEventType,
} from '@ghaarfix/shared-types';
import { redactValue } from '@/modules/reliability/log-redaction.service.js';
import { metricsService } from '@/modules/reliability/metrics.service.js';

function toObjectIdOrUndefined(id?: string): mongoose.Types.ObjectId | undefined {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return undefined;
  return new mongoose.Types.ObjectId(id);
}

export async function recordSecurityEvent(input: {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  actorId?: string;
  targetId?: string;
  actorType?: string;
  sourceIpHash?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.targetId && !mongoose.Types.ObjectId.isValid(input.targetId)) {
    metadata.resourceId = input.targetId;
  }

  await SecurityEvent.create({
    type: input.type,
    severity: input.severity,
    actorId: toObjectIdOrUndefined(input.actorId),
    targetId: toObjectIdOrUndefined(input.targetId),
    actorType: input.actorType,
    sourceIpHash: input.sourceIpHash,
    sessionId: toObjectIdOrUndefined(input.sessionId),
    metadata: redactValue(metadata) as Record<string, unknown>,
    status: SecurityEventStatus.OPEN,
  });
  metricsService.counter('security_events_total', 1, {
    type: input.type,
    severity: input.severity,
  });
}

export async function listSecurityEvents(limit = 50, type?: SecurityEventType) {
  const query = type ? { type } : {};
  const rows = await SecurityEvent.find(query).sort({ createdAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    severity: r.severity,
    actorId: r.actorId?.toString(),
    targetId: r.targetId?.toString(),
    status: r.status,
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
}

export async function recordAuthFailure(actorId?: string, ipHash?: string): Promise<void> {
  metricsService.counter('business_auth_failure', 1);
  await recordSecurityEvent({
    type: SecurityEventType.LOGIN_FAILURE_SPIKE,
    severity: SecurityEventSeverity.LOW,
    actorId,
    sourceIpHash: ipHash,
    metadata: { event: 'login_failed' },
  });
}

export async function recordIdorAttempt(
  actorId: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  await recordSecurityEvent({
    type: SecurityEventType.IDOR_ATTEMPT,
    severity: SecurityEventSeverity.HIGH,
    actorId,
    targetId,
    metadata: { targetType },
  });
}
