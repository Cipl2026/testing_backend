/** Platform commission taken from the job value (Zomato/Swiggy-style). */
export const PLATFORM_COMMISSION_PERCENT = 15;

/** Minimum extra charge for urgent / instant bookings (INR). */
export const URGENT_MIN_SURCHARGE_INR = 200;

export function roundInr(amount: number): number {
  return Math.round(amount);
}

export function calculateUrgentSurcharge(configuredFee: number): number {
  return Math.max(URGENT_MIN_SURCHARGE_INR, roundInr(configuredFee));
}

export interface JobPricingInput {
  serviceAmount: number;
  urgentSurcharge?: number;
  subscriptionBenefit?: number;
  promotionDiscount?: number;
  rewardCredit?: number;
}

export interface JobPricingResult {
  serviceAmount: number;
  urgentSurcharge: number;
  jobSubtotal: number;
  customerJobSubtotal: number;
  subscriptionBenefitAmount: number;
  promotionDiscount: number;
  rewardCredit: number;
  platformFee: number;
  finalAmount: number;
  providerPayoutAmount: number;
}

/**
 * Customer pays: job subtotal (after discounts) + platform fee (15%).
 * Provider earns: job subtotal (after discounts) − platform commission (15%).
 */
export function calculateJobPricing(input: JobPricingInput): JobPricingResult {
  const serviceAmount = Math.max(0, roundInr(input.serviceAmount));
  const urgentSurcharge = Math.max(0, roundInr(input.urgentSurcharge ?? 0));
  const jobSubtotal = serviceAmount + urgentSurcharge;

  const subscriptionBenefitAmount = Math.min(
    Math.max(0, roundInr(input.subscriptionBenefit ?? 0)),
    jobSubtotal,
  );
  const afterSubscription = Math.max(0, jobSubtotal - subscriptionBenefitAmount);
  const promotionDiscount = Math.min(
    Math.max(0, roundInr(input.promotionDiscount ?? 0)),
    afterSubscription,
  );
  const afterPromo = Math.max(0, afterSubscription - promotionDiscount);
  const rewardCredit = Math.min(Math.max(0, roundInr(input.rewardCredit ?? 0)), afterPromo);
  const customerJobSubtotal = Math.max(0, afterPromo - rewardCredit);

  const platformFee = roundInr((customerJobSubtotal * PLATFORM_COMMISSION_PERCENT) / 100);
  const providerPayoutAmount = roundInr(
    (customerJobSubtotal * (100 - PLATFORM_COMMISSION_PERCENT)) / 100,
  );
  const finalAmount = customerJobSubtotal + platformFee;

  return {
    serviceAmount,
    urgentSurcharge,
    jobSubtotal,
    customerJobSubtotal,
    subscriptionBenefitAmount,
    promotionDiscount,
    rewardCredit,
    platformFee,
    finalAmount,
    providerPayoutAmount,
  };
}
