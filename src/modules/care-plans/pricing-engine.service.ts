import { PlanBenefitType } from '@ghaarfix/shared-types';
import * as entitlementService from '@/modules/care-plans/entitlement.service.js';
import { calculateJobPricing } from '@/modules/bookings/booking-pricing.service.js';
import { Entitlement } from '@/models/Entitlement.js';
import { PlanBenefit } from '@/models/PlanBenefit.js';

export interface PricingLineItem {
  type: 'BASE' | 'URGENT' | 'SUBSCRIPTION_BENEFIT' | 'PROMOTION' | 'REWARD' | 'PLATFORM_FEE';
  label: string;
  amount: number;
}

export interface PricingResult {
  baseAmount: number;
  urgentSurcharge: number;
  jobSubtotal: number;
  customerJobSubtotal: number;
  subscriptionBenefitAmount: number;
  promotionDiscount: number;
  rewardCredit: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
  finalAmount: number;
  currency: string;
  entitlementId?: string;
  lineItems: PricingLineItem[];
}

/**
 * Precedence: base → urgent surcharge → subscription → promotion → reward → platform fee.
 * Customer pays job subtotal + 15% platform fee. Provider earns job subtotal − 15%.
 */
export async function calculateBookingPrice(input: {
  baseAmount: number;
  currency: string;
  customerId: string;
  serviceId: string;
  categoryId?: string;
  homeId?: string;
  entitlementId?: string;
  promotionDiscount?: number;
  rewardCredit?: number;
  urgentSurcharge?: number;
}): Promise<PricingResult> {
  const lineItems: PricingLineItem[] = [
    { type: 'BASE', label: 'Service charge', amount: input.baseAmount },
  ];

  const urgentSurcharge = input.urgentSurcharge ?? 0;
  if (urgentSurcharge > 0) {
    lineItems.push({ type: 'URGENT', label: 'Urgent service fee', amount: urgentSurcharge });
  }

  let subscriptionBenefitAmount = 0;
  let entitlementId = input.entitlementId;

  if (input.entitlementId) {
    const ent = await Entitlement.findById(input.entitlementId);
    if (ent) {
      const benefit = await PlanBenefit.findById(ent.benefitId);
      if (benefit) {
        const jobSubtotalBeforeBenefits = input.baseAmount + urgentSurcharge;
        if (
          benefit.type === PlanBenefitType.SERVICE_CREDIT ||
          benefit.type === PlanBenefitType.FREE_VISIT ||
          benefit.type === PlanBenefitType.MAINTENANCE_COVERAGE
        ) {
          subscriptionBenefitAmount = jobSubtotalBeforeBenefits;
          lineItems.push({
            type: 'SUBSCRIPTION_BENEFIT',
            label: (benefit.label as string) ?? 'Care Plan benefit',
            amount: -subscriptionBenefitAmount,
          });
        } else if (benefit.type === PlanBenefitType.DISCOUNT) {
          const pct = (benefit.rules?.percent as number) ?? benefit.quantity;
          subscriptionBenefitAmount = Math.round((jobSubtotalBeforeBenefits * pct) / 100);
          lineItems.push({
            type: 'SUBSCRIPTION_BENEFIT',
            label: `${pct}% Care Plan discount`,
            amount: -subscriptionBenefitAmount,
          });
        }
      }
    }
  }

  const priced = calculateJobPricing({
    serviceAmount: input.baseAmount,
    urgentSurcharge,
    subscriptionBenefit: subscriptionBenefitAmount,
    promotionDiscount: input.promotionDiscount,
    rewardCredit: input.rewardCredit,
  });

  if (priced.promotionDiscount > 0) {
    lineItems.push({ type: 'PROMOTION', label: 'Promotion', amount: -priced.promotionDiscount });
  }
  if (priced.rewardCredit > 0) {
    lineItems.push({ type: 'REWARD', label: 'Reward credit', amount: -priced.rewardCredit });
  }
  if (priced.platformFee > 0) {
    lineItems.push({ type: 'PLATFORM_FEE', label: 'Platform fee', amount: priced.platformFee });
  }

  return {
    baseAmount: priced.serviceAmount,
    urgentSurcharge: priced.urgentSurcharge,
    jobSubtotal: priced.jobSubtotal,
    customerJobSubtotal: priced.customerJobSubtotal,
    subscriptionBenefitAmount: priced.subscriptionBenefitAmount,
    promotionDiscount: priced.promotionDiscount,
    rewardCredit: priced.rewardCredit,
    platformFeeAmount: priced.platformFee,
    providerPayoutAmount: priced.providerPayoutAmount,
    finalAmount: priced.finalAmount,
    currency: input.currency,
    entitlementId,
    lineItems,
  };
}

export async function getEligibleBenefitsForCheckout(input: {
  customerId: string;
  serviceId: string;
  homeId?: string;
  categoryId?: string;
}) {
  return entitlementService.listEligibleEntitlements(input);
}
