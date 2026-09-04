import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { deterministicBucket } from '@/modules/discovery-growth/hash.util.js';

export async function evaluateFlag(
  key: string,
  customerId?: string,
  region?: string,
): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ key: key.toUpperCase() });
  if (!flag || !flag.enabled) return false;

  if (!flag.rules?.length || flag.rules.some((rule) => rule.type === 'global')) {
    return true;
  }

  for (const rule of flag.rules) {
    if (rule.type === 'global') return true;
    if (rule.type === 'whitelist' && customerId && rule.customerIds?.includes(customerId)) {
      return true;
    }
    if (rule.type === 'region' && region && rule.regions?.includes(region)) {
      return true;
    }
    if (rule.type === 'percentage' && customerId) {
      const bucket = deterministicBucket(customerId, key);
      const threshold = rule.percentage ?? 0;
      if (bucket < threshold) return true;
    }
  }

  return false;
}

export async function getCustomerFeatures(customerId: string, region?: string) {
  const flags = await FeatureFlag.find({ enabled: true });
  const result: Record<string, boolean> = {};

  for (const flag of flags) {
    result[flag.key] = await evaluateFlag(flag.key, customerId, region);
  }

  for (const key of Object.values(FeatureFlagKey)) {
    if (!(key in result)) {
      result[key] = false;
    }
  }

  return result;
}

export async function listFeatureFlags() {
  return FeatureFlag.find().sort({ key: 1 });
}

export async function createFeatureFlag(data: Partial<InstanceType<typeof FeatureFlag>>) {
  return FeatureFlag.create(data);
}

export async function updateFeatureFlag(id: string, data: Partial<InstanceType<typeof FeatureFlag>>) {
  return FeatureFlag.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteFeatureFlag(id: string) {
  return FeatureFlag.findByIdAndDelete(id);
}
