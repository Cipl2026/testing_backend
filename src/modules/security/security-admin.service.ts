import { Session } from '@/models/Security.js';
import { listSecurityEvents } from '@/modules/security/security-event.service.js';
import { listSecurityAuditLogs } from '@/modules/security/security-audit.service.js';
import { listSecurityFindings } from '@/modules/security/security-finding.service.js';
import { listDataAssets } from '@/modules/security/data-asset.service.js';
import { listDataExportsAdmin } from '@/modules/security/data-export.service.js';
import { listDeletionRequestsAdmin } from '@/modules/security/account-deletion.service.js';
import { listThreatModels } from '@/modules/security/threat-model.service.js';
import { listRetentionPolicies } from '@/modules/security/data-retention.service.js';
import { listRoles, listPermissions } from '@/modules/security/permission.service.js';

export async function getSecurityOverview() {
  const [
    activeSessions,
    recentEvents,
    openFindings,
    pendingExports,
    pendingDeletions,
    recentAudit,
  ] = await Promise.all([
    Session.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
    listSecurityEvents(10),
    listSecurityFindings(),
    listDataExportsAdmin(10),
    listDeletionRequestsAdmin(10),
    listSecurityAuditLogs(10),
  ]);

  const openFindingsCount = openFindings.filter((f) => f.status === 'OPEN').length;
  const highSeverityEvents = recentEvents.filter((e) => e.severity === 'HIGH' || e.severity === 'CRITICAL');

  return {
    activeSessions,
    recentEvents,
    highSeverityEvents: highSeverityEvents.length,
    openFindings: openFindingsCount,
    pendingExports: pendingExports.filter((e) => e.status === 'PENDING' || e.status === 'PROCESSING').length,
    pendingDeletions: pendingDeletions.filter((d) => d.status === 'SCHEDULED' || d.status === 'REQUESTED').length,
    recentAudit,
  };
}

export async function getSecurityEvents(type?: string) {
  return listSecurityEvents(50, type as never);
}

export async function getSecurityFindings() {
  return listSecurityFindings();
}

export async function getSecurityAuditLogs() {
  return listSecurityAuditLogs(100);
}

export async function getDataAssets() {
  return listDataAssets();
}

export async function getThreatModels() {
  return listThreatModels();
}

export async function getRolesAndPermissions() {
  const [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);
  return { roles, permissions };
}

export async function getRetentionPolicies() {
  return listRetentionPolicies();
}
