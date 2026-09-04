import { ProductRecommendationSource } from '@ghaarfix/shared-types';
import {
  Product,
  ProductRecommendation,
  ProductVariant,
  ProviderProductRecommendation,
} from '@/models/Marketplace.js';
import { filterCompatibleVariantIds } from '@/modules/marketplace/compatibility.service.js';

export async function getMarketplaceRecommendations(
  customerId: string,
  query?: { homeId?: string; assetId?: string },
) {
  const recs = await ProductRecommendation.find({
    customerId,
    isDismissed: false,
    ...(query?.homeId ? { homeId: query.homeId } : {}),
    ...(query?.assetId ? { assetId: query.assetId } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(20);

  const providerRecs = await ProviderProductRecommendation.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(10);

  const productIds = [
    ...recs.map((r) => r.productId?.toString()).filter(Boolean),
    ...providerRecs.map((r) => r.productId?.toString()).filter(Boolean),
  ] as string[];

  const uniqueProductIds = [...new Set(productIds)];
  const products = await Product.find({ _id: { $in: uniqueProductIds }, status: 'ACTIVE' });

  let variantIds = (
    await ProductVariant.find({ productId: { $in: products.map((p) => p._id) } })
  ).map((v) => v._id.toString());

  if (query?.assetId) {
    variantIds = await filterCompatibleVariantIds(variantIds, query.assetId, customerId);
  }

  const items = await Promise.all(
    products.slice(0, 10).map(async (p) => {
      const variant = await ProductVariant.findOne({
        productId: p._id,
        _id: { $in: variantIds },
      });
      const providerRec = providerRecs.find((r) => r.productId?.toString() === p._id.toString());
      const systemRec = recs.find((r) => r.productId?.toString() === p._id.toString());

      return {
        productId: p._id.toString(),
        slug: p.slug,
        name: p.name,
        startingPrice: variant?.price,
        reason:
          providerRec?.reason ??
          systemRec?.reason ??
          'Recommended based on your home setup.',
        source: providerRec
          ? ProductRecommendationSource.PROVIDER_DIAGNOSIS
          : systemRec?.source ?? ProductRecommendationSource.AI_RECOMMENDATION,
        confidence: systemRec?.confidence ?? 0.8,
        explanation: providerRec
          ? `Recommended by your service provider: ${providerRec.diagnosisSummary}`
          : 'Based on your home setup, available inventory, and compatibility rules.',
      };
    }),
  );

  return items.filter((i) => i.startingPrice != null);
}

export async function createRecommendationFromProvider(
  providerRecId: string,
  customerId: string,
) {
  const providerRec = await ProviderProductRecommendation.findById(providerRecId);
  if (!providerRec || providerRec.customerId.toString() !== customerId) return null;

  if (!providerRec.productId) return null;

  await ProductRecommendation.create({
    customerId,
    assetId: providerRec.assetId,
    productId: providerRec.productId,
    variantId: providerRec.variantId,
    source: ProductRecommendationSource.PROVIDER_DIAGNOSIS,
    reason: providerRec.reason,
    confidence: 0.9,
    bookingId: providerRec.bookingId,
    providerRecommendationId: providerRec._id,
  });

  return providerRec;
}
