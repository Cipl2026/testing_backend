import { logger } from '@/utils/logger.js';
import { isSecurityComplianceEnabled } from '@/modules/security/security-feature.service.js';
import { expireStaleSessions } from '@/modules/security/session.service.js';
import { processScheduledDeletions } from '@/modules/security/account-deletion.service.js';
import { enforceRetentionPolicies } from '@/modules/security/data-retention.service.js';
import { runDependencySecurityCheck } from '@/modules/security/security-finding.service.js';
import { DataExportRequest } from '@/models/Security.js';
import { DataExportStatus } from '@ghaarfix/shared-types';

export async function runPhase22Jobs() {
  if (!(await isSecurityComplianceEnabled())) {
    return { enabled: false };
  }

  const results = await Promise.allSettled([
    expireStaleSessions(),
    processScheduledDeletions(),
    enforceRetentionPolicies(),
    runDependencySecurityCheck(),
    expireDataExports(),
  ]);

  const summary = {
    enabled: true,
    expiredSessions: results[0].status === 'fulfilled' ? results[0].value : 0,
    processedDeletions: results[1].status === 'fulfilled' ? results[1].value : 0,
    retentionPolicies: results[2].status === 'fulfilled' ? results[2].value : 0,
    openDependencyFindings: results[3].status === 'fulfilled' ? results[3].value : 0,
    expiredExports: results[4].status === 'fulfilled' ? results[4].value : 0,
  };

  if (Object.values(summary).some((v) => typeof v === 'number' && v > 0)) {
    logger.info('Ran Phase 22 security jobs', summary);
  }

  return summary;
}

async function expireDataExports(): Promise<number> {
  const result = await DataExportRequest.updateMany(
    { status: DataExportStatus.READY, expiresAt: { $lt: new Date() } },
    { status: DataExportStatus.EXPIRED },
  );
  return result.modifiedCount;
}
