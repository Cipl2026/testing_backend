import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { FeatureFlag } from '@/models/FeatureFlag.js';

export async function isFinanceBiEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_FINANCE_BI });
  return flag?.enabled ?? false;
}
