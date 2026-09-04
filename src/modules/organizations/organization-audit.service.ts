import { OrganizationAuditLog } from '@/models/Organization.js';

export async function logOrganizationAudit(input: {
  organizationId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}) {
  return OrganizationAuditLog.create({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    before: input.before,
    after: input.after,
    reason: input.reason,
    timestamp: new Date(),
  });
}

export async function listOrganizationAuditLogs(organizationId: string, limit = 50) {
  return OrganizationAuditLog.find({ organizationId })
    .sort({ timestamp: -1 })
    .limit(limit);
}
