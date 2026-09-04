import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { FeatureFlag } from '@/models/FeatureFlag.js';

export async function isLifecycleGrowthEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_LIFECYCLE_GROWTH });
  return flag?.enabled ?? false;
}
