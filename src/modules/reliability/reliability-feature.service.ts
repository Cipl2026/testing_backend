import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';

export async function isReliabilityObservabilityEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_RELIABILITY_OBSERVABILITY });
  return flag?.enabled ?? true;
}
