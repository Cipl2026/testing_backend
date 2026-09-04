import { TaxPolicy } from '@/models/Globalization.js';
import { calculateTax as legacyCalculateTax } from '@/modules/tax/tax.service.js';
import type { TaxBreakdown } from '@/modules/tax/tax.service.js';
import { resolveRegionalPolicies } from '@/modules/globalization/regional-config.service.js';
import { TaxInclusionMode } from '@ghaarfix/shared-types';

export async function calculateRegionalTax(
  subtotal: number,
  regionId?: string,
): Promise<TaxBreakdown & { inclusionMode?: string; policyName?: string }> {
  if (regionId) {
    const policies = await resolveRegionalPolicies(regionId);
    if (policies.taxPolicy) {
      const rate = policies.taxPolicy.ratePercent;
      const taxRate = rate / 100;
      if (policies.taxPolicy.inclusionMode === TaxInclusionMode.INCLUSIVE) {
        const taxAmount = Math.round((subtotal - subtotal / (1 + taxRate)) * 100) / 100;
        return {
          subtotal: Math.round((subtotal - taxAmount) * 100) / 100,
          taxRate: rate,
          taxAmount,
          total: subtotal,
          inclusionMode: TaxInclusionMode.INCLUSIVE,
        };
      }
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      return {
        subtotal,
        taxRate: rate,
        taxAmount,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        inclusionMode: TaxInclusionMode.EXCLUSIVE,
      };
    }
    const direct = await TaxPolicy.findOne({
      regionId,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
    });
    if (direct) {
      const taxRate = direct.ratePercent / 100;
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      return {
        subtotal,
        taxRate: direct.ratePercent,
        taxAmount,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        inclusionMode: direct.inclusionMode,
        policyName: direct.name,
      };
    }
  }
  return legacyCalculateTax(subtotal);
}
