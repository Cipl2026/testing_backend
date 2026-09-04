import { CommissionType, type MarketplacePricingResult } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { MarketplaceCommissionRule } from '@/models/Marketplace.js';

export async function calculateMarketplacePrice(input: {
  items: Array<{ variantId: string; partnerId: string; quantity: number; unitPrice: number }>;
  deliveryFee?: number;
  installationFee?: number;
  subscriptionBenefit?: number;
  promotionDiscount?: number;
  rewardCredit?: number;
}): Promise<MarketplacePricingResult> {
  const productSubtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const deliveryFee = input.deliveryFee ?? (productSubtotal > 999 ? 0 : 49);
  const installationFee = input.installationFee ?? 0;

  const lineItems = [
    { type: 'PRODUCT', label: 'Products', amount: productSubtotal },
    ...(deliveryFee > 0 ? [{ type: 'DELIVERY', label: 'Delivery', amount: deliveryFee }] : []),
    ...(installationFee > 0
      ? [{ type: 'INSTALLATION', label: 'Professional installation', amount: installationFee }]
      : []),
  ];

  let subscriptionBenefit = input.subscriptionBenefit ?? 0;
  if (subscriptionBenefit > 0) {
    lineItems.push({ type: 'SUBSCRIPTION_BENEFIT', label: 'Care Plan benefit', amount: -subscriptionBenefit });
  }

  const afterBenefit = Math.max(0, productSubtotal + deliveryFee + installationFee - subscriptionBenefit);
  const promotionDiscount = Math.min(input.promotionDiscount ?? 0, afterBenefit);
  if (promotionDiscount > 0) {
    lineItems.push({ type: 'PROMOTION', label: 'Promotion', amount: -promotionDiscount });
  }

  const afterPromo = afterBenefit - promotionDiscount;
  const rewardCredit = Math.min(input.rewardCredit ?? 0, afterPromo);
  if (rewardCredit > 0) {
    lineItems.push({ type: 'REWARD', label: 'Rewards', amount: -rewardCredit });
  }

  const taxable = Math.max(0, afterPromo - rewardCredit);
  const tax = Math.round((taxable * (env.tax.ratePercent ?? 0)) / 100);
  if (tax > 0) lineItems.push({ type: 'TAX', label: 'Tax', amount: tax });

  const finalAmount = taxable + tax;

  const commissionSnapshots = await Promise.all(
    input.items.map(async (item) => {
      const rule = await MarketplaceCommissionRule.findOne({
        isActive: true,
        $or: [{ partnerId: item.partnerId }, { partnerId: { $exists: false } }],
      }).sort({ partnerId: -1 });

      const lineTotal = item.unitPrice * item.quantity;
      let commission = 0;
      let rate = 0;
      if (rule) {
        if (rule.commissionType === CommissionType.PERCENTAGE) {
          rate = rule.value;
          commission = Math.round((lineTotal * rule.value) / 100);
        } else if (rule.commissionType === CommissionType.FIXED) {
          commission = rule.fixedAmount ?? rule.value;
        } else {
          rate = rule.value;
          commission = Math.round((lineTotal * rule.value) / 100) + (rule.fixedAmount ?? 0);
        }
      } else {
        rate = 10;
        commission = Math.round((lineTotal * 10) / 100);
      }
      return { partnerId: item.partnerId, amount: commission, rate };
    }),
  );

  return {
    productSubtotal,
    deliveryFee,
    installationFee,
    subscriptionBenefit,
    promotionDiscount,
    rewardCredit,
    tax,
    finalAmount,
    currency: 'INR',
    lineItems,
    commissionSnapshots,
  };
}
