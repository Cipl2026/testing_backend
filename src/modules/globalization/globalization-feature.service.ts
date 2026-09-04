import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';

export async function isGlobalizationEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_GLOBALIZATION });
  return flag?.enabled ?? true;
}
