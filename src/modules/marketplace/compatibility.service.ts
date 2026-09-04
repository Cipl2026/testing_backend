import { CompatibilityLevel, type CompatibilityCheckResult } from '@ghaarfix/shared-types';
import { HomeAsset } from '@/models/HomeAsset.js';
import { ProductCompatibilityRule, ProductVariant } from '@/models/Marketplace.js';
import { getOwnedHome } from '@/modules/home-health/helpers.js';

export async function checkCompatibility(input: {
  customerId: string;
  variantId: string;
  assetId?: string;
  homeId?: string;
}): Promise<CompatibilityCheckResult> {
  const variant = await ProductVariant.findById(input.variantId);
  if (!variant) {
    return {
      level: CompatibilityLevel.UNKNOWN,
      reason: 'Product variant not found.',
      warnings: ['Verify compatibility before purchase.'],
    };
  }

  if (!input.assetId) {
    return {
      level: CompatibilityLevel.UNKNOWN,
      reason: 'No home asset selected for compatibility check.',
      warnings: ['Select your appliance to verify compatibility.'],
    };
  }

  const asset = await HomeAsset.findById(input.assetId);
  if (!asset) {
    return { level: CompatibilityLevel.UNKNOWN, reason: 'Asset not found.', warnings: [] };
  }

  if (input.homeId) {
    await getOwnedHome(input.customerId, input.homeId);
  } else {
    await getOwnedHome(input.customerId, asset.homeId.toString());
  }

  const rules = await ProductCompatibilityRule.find({
    productVariantId: variant._id,
    isActive: true,
    $or: [
      { assetTypeId: asset.assetTypeId },
      { brandId: { $exists: false } },
      ...(asset.brand ? [{ modelPattern: new RegExp(asset.brand, 'i') }] : []),
    ],
  });

  if (!rules.length) {
    if (asset.assetTypeId) {
      const typeRule = await ProductCompatibilityRule.findOne({
        productVariantId: variant._id,
        assetTypeId: asset.assetTypeId,
        isActive: true,
      });
      if (typeRule) {
        return mapRule(typeRule.compatibilityLevel, typeRule.reason);
      }
    }
    return {
      level: CompatibilityLevel.UNKNOWN,
      reason: 'Compatibility needs verification for your setup.',
      warnings: ['Contact support or your service provider before buying.'],
    };
  }

  const incompatible = rules.find((r) => r.compatibilityLevel === CompatibilityLevel.INCOMPATIBLE);
  if (incompatible) return mapRule(incompatible.compatibilityLevel, incompatible.reason);

  const confirmed = rules.find((r) => r.compatibilityLevel === CompatibilityLevel.CONFIRMED);
  if (confirmed) return mapRule(confirmed.compatibilityLevel, confirmed.reason);

  const likely = rules.find((r) => r.compatibilityLevel === CompatibilityLevel.LIKELY);
  if (likely) return mapRule(likely.compatibilityLevel, likely.reason);

  return mapRule(rules[0]!.compatibilityLevel, rules[0]!.reason);
}

function mapRule(level: CompatibilityLevel, reason: string): CompatibilityCheckResult {
  const warnings: string[] = [];
  if (level === CompatibilityLevel.LIKELY) {
    warnings.push('Likely compatible — confirm model details before purchase.');
  }
  if (level === CompatibilityLevel.UNKNOWN) {
    warnings.push('Compatibility needs verification.');
  }
  if (level === CompatibilityLevel.INCOMPATIBLE) {
    warnings.push('This product may not work with your setup.');
  }
  return { level, reason, warnings };
}

export async function filterCompatibleVariantIds(
  variantIds: string[],
  assetId?: string,
  customerId?: string,
): Promise<string[]> {
  if (!assetId || !customerId) return variantIds;

  const results = await Promise.all(
    variantIds.map(async (id) => {
      const check = await checkCompatibility({ customerId, variantId: id, assetId });
      return check.level !== CompatibilityLevel.INCOMPATIBLE ? id : null;
    }),
  );
  return results.filter((id): id is string => id != null);
}
