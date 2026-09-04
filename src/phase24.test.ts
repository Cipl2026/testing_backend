import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { FeatureFlagKey, RegionType } from '@ghaarfix/shared-types';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { runPhase24Migrations } from '@/migrations/014-phase24-globalization.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { Region } from '@/models/Globalization.js';
import { seedGlobalRegion, createRegion, activateRegion } from '@/modules/globalization/region.service.js';
import { resolveRegionalPolicies, upsertRegionalConfiguration } from '@/modules/globalization/regional-config.service.js';
import { resolveRegionFromLocation } from '@/modules/globalization/region-resolve.service.js';
import { translate } from '@/modules/globalization/localization.service.js';
import { createMoney, formatMoney, toMinorUnits } from '@/modules/globalization/money.service.js';
import { calculateRegionalTax } from '@/modules/globalization/tax-policy.service.js';
import { createApiClient, verifyApiKey, rotateApiKey } from '@/modules/globalization/partner.service.js';
import { AppError } from '@/utils/AppError.js';

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

describe('Phase 24 — Globalization', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase24Migrations();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await runPhase24Migrations();
  });

  it('seeds region hierarchy', async () => {
    const global = await Region.findOne({ code: 'GLOBAL' });
    const india = await Region.findOne({ code: 'IN' });
    expect(global?.type).toBe(RegionType.GLOBAL);
    expect(india?.type).toBe(RegionType.COUNTRY);
    expect(india?.parentId?.toString()).toBe(global?._id.toString());
  });

  it('resolves configuration inheritance', async () => {
    const india = await Region.findOne({ code: 'IN' });
    const policies = await resolveRegionalPolicies(india!._id.toString());
    expect(policies.currency).toBe('INR');
    expect(policies.timezone).toBe('Asia/Kolkata');
    expect(policies.supportedLocales).toContain('hi-IN');
  });

  it('applies most-specific configuration override', async () => {
    const india = await Region.findOne({ code: 'IN' });
    const city = await createRegion({
      name: 'Delhi NCR',
      code: 'DEL',
      type: RegionType.CITY,
      parentId: india!._id.toString(),
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      currencyCode: 'INR',
      locale: 'en-IN',
    });
    await upsertRegionalConfiguration(city.id, {
      defaultLocale: 'hi-IN',
      paymentMethods: ['UPI'],
    });
    const policies = await resolveRegionalPolicies(city.id);
    expect(policies.defaultLocale).toBe('hi-IN');
    expect(policies.paymentMethods).toContain('UPI');
  });

  it('resolves region from location', async () => {
    const result = await resolveRegionFromLocation({
      countryCode: 'IN',
      city: 'Delhi',
    });
    expect(result.region?.code).toBe('IN');
    expect(result.supported).toBe(true);
  });

  it('returns unsupported for inactive region', async () => {
    const region = await createRegion({
      name: 'Test Country',
      code: 'TC',
      type: RegionType.COUNTRY,
      timezone: 'UTC',
      currencyCode: 'USD',
      locale: 'en-US',
    });
    const result = await resolveRegionFromLocation({ countryCode: 'TC' });
    expect(result.supported).toBe(false);
    expect(result.message).toBeTruthy();
    expect(region.isActive).toBe(false);
  });

  it('falls back translations without exposing keys', async () => {
    const hi = await translate('booking.status.accepted', 'hi-IN');
    expect(hi).toBe('स्वीकृत');
    const fallback = await translate('booking.status.accepted', 'fr-FR');
    expect(fallback).not.toBe('booking.status.accepted');
  });

  it('uses currency minor units', () => {
    const money = createMoney(499.5, 'INR');
    expect(money.amountMinor).toBe(49950);
    expect(formatMoney(money, 'en-IN')).toContain('499');
  });

  it('calculates regional tax', async () => {
    const india = await Region.findOne({ code: 'IN' });
    const tax = await calculateRegionalTax(1000, india!._id.toString());
    expect(tax.taxRate).toBe(18);
    expect(tax.total).toBeGreaterThan(1000);
  });

  it('hashes API keys and verifies scope', async () => {
    const { client, apiKey } = await createApiClient({
      name: 'Test Partner',
      scopes: ['catalog.read'],
    });
    const verified = await verifyApiKey(apiKey, 'catalog.read');
    expect(verified._id.toString()).toBe(client._id.toString());
    await expect(verifyApiKey(apiKey, 'booking.create')).rejects.toThrow(AppError);
  });

  it('rotates API keys', async () => {
    const { client, apiKey: oldKey } = await createApiClient({
      name: 'Rotate Test',
      scopes: ['catalog.read'],
    });
    const { apiKey: newKey } = await rotateApiKey(client._id.toString());
    expect(newKey).not.toBe(oldKey);
    await expect(verifyApiKey(oldKey, 'catalog.read')).rejects.toThrow();
    await expect(verifyApiKey(newKey, 'catalog.read')).resolves.toBeTruthy();
  });

  it('blocks region activation without checklist', async () => {
    const region = await createRegion({
      name: 'Incomplete',
      code: 'INC',
      type: RegionType.COUNTRY,
      timezone: 'UTC',
      currencyCode: 'USD',
      locale: 'en',
    });
    await expect(activateRegion(region.id)).rejects.toThrow(/checklist/i);
  });

  it('respects feature flag', async () => {
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_GLOBALIZATION },
      { enabled: false },
    );
    const { isGlobalizationEnabled } = await import(
      '@/modules/globalization/globalization-feature.service.js'
    );
    expect(await isGlobalizationEnabled()).toBe(false);
  });
});
