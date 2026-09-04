import { MarketplaceWarrantyStatus } from '@ghaarfix/shared-types';
import {
  MarketplaceOrder,
  OrderItem,
  Product,
  ProductVariant,
  WarrantyRecord,
} from '@/models/Marketplace.js';

export async function createWarrantiesForOrder(orderId: string) {
  const order = await MarketplaceOrder.findById(orderId);
  if (!order) return 0;

  const items = await OrderItem.find({ orderId });
  let created = 0;

  for (const item of items) {
    const variant = await ProductVariant.findById(item.variantId);
    const product = variant ? await Product.findById(variant.productId) : null;

    const warrantyMonths = (product?.warrantyConfig as { months?: number })?.months ?? 12;
    const purchaseDate = new Date();
    const warrantyEnd = new Date(purchaseDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths);

    await WarrantyRecord.create({
      customerId: order.customerId,
      orderItemId: item._id,
      productId: product?._id ?? item.variantId,
      brandId: product?.brandId,
      purchaseDate,
      warrantyStart: purchaseDate,
      warrantyEnd,
      status: MarketplaceWarrantyStatus.ACTIVE,
    });
    created += 1;
  }

  return created;
}

export async function listCustomerWarranties(customerId: string) {
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const warranties = await WarrantyRecord.find({ customerId }).sort({ warrantyEnd: 1 });

  return warranties.map((w) => {
    let status = w.status;
    if (w.warrantyEnd < now) status = MarketplaceWarrantyStatus.EXPIRED;
    else if (w.warrantyEnd < in90) status = MarketplaceWarrantyStatus.EXPIRING;

    return {
      id: w._id.toString(),
      productId: w.productId.toString(),
      serialNumber: w.serialNumber,
      purchaseDate: w.purchaseDate,
      warrantyStart: w.warrantyStart,
      warrantyEnd: w.warrantyEnd,
      status,
      assetId: w.assetId?.toString(),
    };
  });
}

export async function sendWarrantyReminders() {
  const thresholds = [90, 30, 7];
  let sent = 0;

  for (const days of thresholds) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const expiring = await WarrantyRecord.find({
      warrantyEnd: { $gte: start, $lte: end },
      status: { $in: [MarketplaceWarrantyStatus.ACTIVE, MarketplaceWarrantyStatus.EXPIRING] },
    }).limit(50);

    sent += expiring.length;
  }

  return sent;
}
