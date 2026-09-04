import { SecurityAuditLog } from '@/models/Security.js';
import { redactValue } from '@/modules/reliability/log-redaction.service.js';

export async function logSecurityAudit(input: {
  actorId?: string;
  actorType: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  sessionId?: string;
}): Promise<void> {
  const sanitized = redactValue(input.metadata ?? {}) as Record<string, unknown>;
  await SecurityAuditLog.create({
    actorId: input.actorId,
    actorType: input.actorType,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: sanitized,
    ipHash: input.ipHash,
    sessionId: input.sessionId,
  });
}

export async function listSecurityAuditLogs(limit = 50, action?: string) {
  const query = action ? { action } : {};
  const rows = await SecurityAuditLog.find(query).sort({ createdAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    actorId: r.actorId?.toString(),
    actorType: r.actorType,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId?.toString(),
    metadata: r.metadata,
    createdAt: r.createdAt,
  }));
}
