import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';

export async function isScalePerformanceEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_SCALE_PERFORMANCE });
  return flag?.enabled ?? true;
}
