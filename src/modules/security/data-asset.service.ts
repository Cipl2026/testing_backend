import { DataClassification } from '@ghaarfix/shared-types';
import { DataAsset } from '@/models/Security.js';

const DEFAULT_ASSETS = [
  {
    name: 'customer_profiles',
    location: 'mongodb:customerprofiles',
    classification: DataClassification.CONFIDENTIAL,
    purpose: 'Customer identity and preferences',
    accessRoles: ['CUSTOMER', 'ADMIN'],
    retentionDays: 2555,
    owner: 'Platform Team',
  },
  {
    name: 'service_catalog',
    location: 'mongodb:services',
    classification: DataClassification.PUBLIC,
    purpose: 'Public service discovery',
    accessRoles: ['CUSTOMER', 'PROVIDER', 'ADMIN'],
    retentionDays: 3650,
    owner: 'Catalog Team',
  },
  {
    name: 'financial_ledger',
    location: 'mongodb:financiallentries',
    classification: DataClassification.RESTRICTED,
    purpose: 'Financial reconciliation and compliance',
    accessRoles: ['ADMIN'],
    retentionDays: 2555,
    owner: 'Finance Team',
  },
  {
    name: 'provider_identity_documents',
    location: 'storage:provider-docs',
    classification: DataClassification.RESTRICTED,
    purpose: 'Provider verification',
    accessRoles: ['ADMIN'],
    retentionDays: 2555,
    owner: 'Trust Team',
  },
];

export async function seedDataAssets(): Promise<void> {
  for (const asset of DEFAULT_ASSETS) {
    await DataAsset.findOneAndUpdate({ name: asset.name }, asset, { upsert: true });
  }
}

export async function listDataAssets() {
  return DataAsset.find().sort({ classification: -1, name: 1 });
}
