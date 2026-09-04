import { RegionalServiceCatalog, RegionalPaymentPolicy, TaxPolicy } from '@/models/Globalization.js';
import { resolveRegionalPolicies } from '@/modules/globalization/regional-config.service.js';
import * as regionService from '@/modules/globalization/region.service.js';
import * as serviceAreaService from '@/modules/globalization/service-area.service.js';
import * as partnerService from '@/modules/globalization/partner.service.js';
import * as expansionService from '@/modules/globalization/expansion-analytics.service.js';
import { upsertRegionalConfiguration } from '@/modules/globalization/regional-config.service.js';

export async function getExpansionOverview() {
  const analytics = await expansionService.getExpansionAnalytics();
  return analytics;
}

export async function getRegionalCatalog(regionId?: string) {
  const query = regionId ? { regionId } : {};
  return RegionalServiceCatalog.find(query).populate('serviceId', 'name slug');
}

export async function getRegionalPricing(regionId?: string) {
  const { RegionalPricingPolicy } = await import('@/models/Globalization.js');
  const query = regionId ? { regionId, isActive: true } : { isActive: true };
  return RegionalPricingPolicy.find(query);
}

export async function getRegionalTaxes(regionId?: string) {
  const query = regionId ? { regionId, isActive: true } : { isActive: true };
  return TaxPolicy.find(query);
}

export async function getRegionalPayments(regionId?: string) {
  const query = regionId ? { regionId, isActive: true } : { isActive: true };
  return RegionalPaymentPolicy.find(query);
}

export {
  regionService,
  serviceAreaService,
  partnerService,
  expansionService,
  resolveRegionalPolicies,
  upsertRegionalConfiguration,
};
