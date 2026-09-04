import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';

export async function isSecurityComplianceEnabled(): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: FeatureFlagKey.ENABLE_SECURITY_COMPLIANCE });
  return flag?.enabled ?? true;
}
