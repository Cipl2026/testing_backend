import { DEFAULT_RETENTION_POLICIES } from '@ghaarfix/shared-types';
import { DataRetentionPolicy } from '@/models/Security.js';

export async function seedRetentionPolicies(): Promise<void> {
  for (const policy of DEFAULT_RETENTION_POLICIES) {
    await DataRetentionPolicy.findOneAndUpdate(
      { dataType: policy.dataType },
      {
        dataType: policy.dataType,
        retentionDays: policy.retentionDays,
        actionAfterExpiry: policy.actionAfterExpiry,
        legalBasis: policy.legalBasis,
      },
      { upsert: true },
    );
  }
}

export async function listRetentionPolicies() {
  return DataRetentionPolicy.find().sort({ dataType: 1 });
}

export async function enforceRetentionPolicies(): Promise<number> {
  const policies = await DataRetentionPolicy.find();
  return policies.length;
}
