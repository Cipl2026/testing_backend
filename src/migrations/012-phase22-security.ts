import {
  Session,
  StepUpAuthentication,
  SecurityEvent,
  SecurityAuditLog,
  SecurityFinding,
  DataAsset,
  PrivacyConsentRecord,
  DataExportRequest,
  AccountDeletionRequest,
  DataRetentionPolicy,
  ThreatModel,
  SecurityRole,
  SecurityPermission,
  OrganizationSecurityPolicy,
  AdminMfaConfig,
} from '@/models/Security.js';
import { RefreshToken } from '@/models/RefreshToken.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { seedSecurityPermissions } from '@/modules/security/permission.service.js';
import { seedThreatModel } from '@/modules/security/threat-model.service.js';
import { seedDataAssets } from '@/modules/security/data-asset.service.js';
import { seedRetentionPolicies } from '@/modules/security/data-retention.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase22Migrations() {
  await Promise.all([
    Session.syncIndexes(),
    StepUpAuthentication.syncIndexes(),
    SecurityEvent.syncIndexes(),
    SecurityAuditLog.syncIndexes(),
    SecurityFinding.syncIndexes(),
    DataAsset.syncIndexes(),
    PrivacyConsentRecord.syncIndexes(),
    DataExportRequest.syncIndexes(),
    AccountDeletionRequest.syncIndexes(),
    DataRetentionPolicy.syncIndexes(),
    ThreatModel.syncIndexes(),
    SecurityRole.syncIndexes(),
    SecurityPermission.syncIndexes(),
    OrganizationSecurityPolicy.syncIndexes(),
    AdminMfaConfig.syncIndexes(),
    RefreshToken.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_SECURITY_COMPLIANCE },
    {
      key: FeatureFlagKey.ENABLE_SECURITY_COMPLIANCE,
      enabled: true,
      rules: [{ type: 'global' }],
    },
    { upsert: true },
  );

  await seedSecurityPermissions();
  await seedThreatModel();
  await seedDataAssets();
  await seedRetentionPolicies();

  logger.info('Phase 22 security compliance indexes ensured');
}
