import { ErrorCode } from '@ghaarfix/shared-types';
import { MarketplaceCart, Product, ProductVariant } from '@/models/Marketplace.js';
import { blockIncompatiblePurchase } from '@/modules/marketplace/catalog.service.js';
import { calculateMarketplacePrice } from '@/modules/marketplace/marketplace-pricing.service.js';
import { AppError } from '@/utils/AppError.js';

export async function getCart(customerId: string) {
  let cart = await MarketplaceCart.findOne({ customerId });
  if (!cart) {
    cart = await MarketplaceCart.create({ customerId, items: [] });
  }
  return serializeCart(cart);
}

export async function addToCart(
  customerId: string,
  input: {
    variantId: string;
    partnerId: string;
    quantity: number;
    includeInstallation?: boolean;
    assetId?: string;
  },
) {
  await blockIncompatiblePurchase(customerId, input.variantId, input.assetId);

  const variant = await ProductVariant.findById(input.variantId);
  if (!variant) throw new AppError('Variant not found.', 404, ErrorCode.NOT_FOUND);

  let cart = await MarketplaceCart.findOne({ customerId });
  if (!cart) cart = await MarketplaceCart.create({ customerId, items: [] });

  const existing = cart.items.find(
    (i) => i.variantId.toString() === input.variantId && i.partnerId.toString() === input.partnerId,
  );

  if (existing) {
    existing.quantity += input.quantity;
    if (input.includeInstallation) existing.includeInstallation = true;
  } else {
    cart.items.push({
      variantId: variant._id,
      partnerId: input.partnerId as unknown as import('mongoose').Types.ObjectId,
      quantity: input.quantity,
      includeInstallation: input.includeInstallation,
    });
  }

  await cart.save();
  return serializeCart(cart);
}

async function serializeCart(cart: InstanceType<typeof MarketplaceCart>) {
  const lineItems = await Promise.all(
    cart.items.map(async (item) => {
      const variant = await ProductVariant.findById(item.variantId);
      const product = variant ? await Product.findById(variant.productId) : null;
      return {
        variantId: item.variantId.toString(),
        partnerId: item.partnerId.toString(),
        quantity: item.quantity,
        includeInstallation: item.includeInstallation,
        unitPrice: variant?.price ?? 0,
        name: variant?.name,
        productName: product?.name,
        productSlug: product?.slug,
      };
    }),
  );

  const pricing = await calculateMarketplacePrice({
    items: lineItems.map((l) => ({
      variantId: l.variantId,
      partnerId: l.partnerId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    installationFee: lineItems.some((l) => l.includeInstallation) ? 299 : 0,
  });

  return {
    items: lineItems,
    pricing,
    itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function clearCart(customerId: string) {
  await MarketplaceCart.findOneAndUpdate({ customerId }, { items: [] });
}
