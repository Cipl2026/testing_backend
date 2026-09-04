import mongoose from 'mongoose';
import {
  Region,
  RegionalConfiguration,
  type IRegionalConfiguration,
  TaxPolicy,
  RegionalPaymentPolicy,
  ProviderOnboardingPolicy,
} from '@/models/Globalization.js';
import { RegionType } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export interface ResolvedRegionalPolicies {
  regionId: string;
  regionCode: string;
  regionType: RegionType;
  currency: string;
  timezone: string;
  defaultLocale: string;
  supportedLocales: string[];
  paymentMethods: string[];
  taxPolicy?: { ratePercent: number; inclusionMode: string };
  providerPolicy?: { requiredDocuments: unknown[] };
  bookingPolicy?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
  chain: string[];
}

export async function getRegionChain(regionId: string): Promise<mongoose.Types.ObjectId[]> {
  const chain: mongoose.Types.ObjectId[] = [];
  let current = await Region.findById(regionId);
  while (current) {
    chain.unshift(current._id);
    if (!current.parentId) break;
    current = await Region.findById(current.parentId);
  }
  const global = await Region.findOne({ type: RegionType.GLOBAL });
  if (global && !chain.some((id) => id.equals(global._id))) {
    chain.unshift(global._id);
  }
  return chain;
}

export async function resolveRegionalPolicies(regionId: string): Promise<ResolvedRegionalPolicies> {
  const region = await Region.findById(regionId);
  if (!region) {
    throw new AppError('Region not found.', 404, ErrorCode.NOT_FOUND);
  }

  const chain = await getRegionChain(regionId);
  const configs = await RegionalConfiguration.find({
    regionId: { $in: chain },
  }).sort({ version: -1 });

  const latestByRegion = new Map<string, (typeof configs)[0]>();
  for (const cfg of configs) {
    const id = cfg.regionId.toString();
    if (!latestByRegion.has(id)) latestByRegion.set(id, cfg);
  }

  let merged = {
    currency: region.currencyCode,
    timezone: region.timezone,
    defaultLocale: region.locale,
    supportedLocales: [region.locale],
    paymentMethods: [] as string[],
    taxPolicyId: undefined as mongoose.Types.ObjectId | undefined,
    providerPolicyId: undefined as mongoose.Types.ObjectId | undefined,
    bookingPolicy: undefined as Record<string, unknown> | undefined,
    featureFlags: {} as Record<string, boolean>,
  };

  for (const regionOid of chain) {
    const cfg = latestByRegion.get(regionOid.toString());
    if (!cfg) continue;
    merged = {
      currency: cfg.currency || merged.currency,
      timezone: cfg.timezone || merged.timezone,
      defaultLocale: cfg.defaultLocale || merged.defaultLocale,
      supportedLocales: cfg.supportedLocales?.length
        ? cfg.supportedLocales
        : merged.supportedLocales,
      paymentMethods: cfg.paymentMethods?.length ? cfg.paymentMethods : merged.paymentMethods,
      taxPolicyId: cfg.taxPolicyId ?? merged.taxPolicyId,
      providerPolicyId: cfg.providerPolicyId ?? merged.providerPolicyId,
      bookingPolicy: cfg.bookingPolicy ?? merged.bookingPolicy,
      featureFlags: { ...merged.featureFlags, ...(cfg.featureFlags ?? {}) },
    };
  }

  let taxPolicy: ResolvedRegionalPolicies['taxPolicy'];
  if (merged.taxPolicyId) {
    const tax = await TaxPolicy.findById(merged.taxPolicyId);
    if (tax?.isActive) {
      taxPolicy = { ratePercent: tax.ratePercent, inclusionMode: tax.inclusionMode };
    }
  }

  let providerPolicy: ResolvedRegionalPolicies['providerPolicy'];
  if (merged.providerPolicyId) {
    const policy = await ProviderOnboardingPolicy.findById(merged.providerPolicyId);
    if (policy?.isActive) {
      providerPolicy = { requiredDocuments: policy.requiredDocuments };
    }
  } else {
    const direct = await ProviderOnboardingPolicy.findOne({ regionId, isActive: true });
    if (direct) providerPolicy = { requiredDocuments: direct.requiredDocuments };
  }

  if (!merged.paymentMethods.length) {
    const payment = await RegionalPaymentPolicy.findOne({ regionId, isActive: true });
    if (payment) {
      merged.paymentMethods = payment.methods.filter((m) => m.enabled).map((m) => m.methodType);
    }
  }

  return {
    regionId: region._id.toString(),
    regionCode: region.code,
    regionType: region.type,
    currency: merged.currency,
    timezone: merged.timezone,
    defaultLocale: merged.defaultLocale,
    supportedLocales: merged.supportedLocales,
    paymentMethods: merged.paymentMethods,
    taxPolicy,
    providerPolicy,
    bookingPolicy: merged.bookingPolicy,
    featureFlags: merged.featureFlags,
    chain: chain.map((id) => id.toString()),
  };
}

export async function upsertRegionalConfiguration(
  regionId: string,
  input: Partial<{
    currency: string;
    timezone: string;
    defaultLocale: string;
    supportedLocales: string[];
    paymentMethods: string[];
    bookingPolicy: Record<string, unknown>;
    featureFlags: Record<string, boolean>;
  }>,
  updatedBy?: string,
): Promise<IRegionalConfiguration> {
  const latest = await RegionalConfiguration.findOne({ regionId }).sort({ version: -1 });
  const version = (latest?.version ?? 0) + 1;
  return RegionalConfiguration.create({
    regionId,
    version,
    effectiveAt: new Date(),
    currency: input.currency ?? latest?.currency ?? 'INR',
    timezone: input.timezone ?? latest?.timezone ?? 'UTC',
    defaultLocale: input.defaultLocale ?? latest?.defaultLocale ?? 'en',
    supportedLocales: input.supportedLocales ?? latest?.supportedLocales ?? ['en'],
    paymentMethods: input.paymentMethods ?? latest?.paymentMethods ?? [],
    bookingPolicy: input.bookingPolicy ?? latest?.bookingPolicy,
    featureFlags: input.featureFlags ?? latest?.featureFlags,
    updatedBy: updatedBy && mongoose.Types.ObjectId.isValid(updatedBy)
      ? new mongoose.Types.ObjectId(updatedBy)
      : undefined,
  });
}
