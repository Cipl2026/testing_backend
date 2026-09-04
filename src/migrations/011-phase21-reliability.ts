import {
  OperationalAlert,
  Incident,
  IncidentTimelineEvent,
  PostmortemAction,
  ServiceLevelObjective,
  ServiceLevelSnapshot,
  BackupVerification,
  DeadLetterJob,
  ReleaseHealthSnapshot,
  DisasterRecoveryPlan,
  MonitoredError,
  MaintenanceModeConfig,
} from '@/models/Reliability.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { seedDefaultSlos } from '@/modules/reliability/slo.service.js';
import { seedDisasterRecoveryPlans } from '@/modules/reliability/disaster-recovery.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase21Migrations() {
  await Promise.all([
    OperationalAlert.syncIndexes(),
    Incident.syncIndexes(),
    IncidentTimelineEvent.syncIndexes(),
    PostmortemAction.syncIndexes(),
    ServiceLevelObjective.syncIndexes(),
    ServiceLevelSnapshot.syncIndexes(),
    BackupVerification.syncIndexes(),
    DeadLetterJob.syncIndexes(),
    ReleaseHealthSnapshot.syncIndexes(),
    DisasterRecoveryPlan.syncIndexes(),
    MonitoredError.syncIndexes(),
    MaintenanceModeConfig.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_RELIABILITY_OBSERVABILITY },
    {
      key: FeatureFlagKey.ENABLE_RELIABILITY_OBSERVABILITY,
      enabled: true,
      rules: [{ type: 'global' }],
    },
    { upsert: true },
  );

  await MaintenanceModeConfig.findOneAndUpdate(
    { key: 'global' },
    { key: 'global' },
    { upsert: true },
  );

  await seedDefaultSlos();
  await seedDisasterRecoveryPlans();

  logger.info('Phase 21 reliability observability indexes ensured');
}
