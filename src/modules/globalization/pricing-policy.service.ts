import { RegionalPricingPolicy } from '@/models/Globalization.js';
import { Service } from '@/models/Service.js';

export interface PriceBreakdown {
  baseAmount: number;
  regionalAdjustment: number;
  urgentSurcharge: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
}

export async function calculateRegionalPrice(input: {
  serviceId: string;
  regionId: string;
  baseAmount: number;
  currency: string;
  isUrgent?: boolean;
  discount?: number;
  taxAmount?: number;
}): Promise<PriceBreakdown> {
  const service = await Service.findById(input.serviceId);
  const baseAmount = input.baseAmount || service?.pricing?.startingPrice || 0;

  const policies = await RegionalPricingPolicy.find({
    regionId: input.regionId,
    isActive: true,
    $or: [{ serviceId: input.serviceId }, { serviceId: null }],
    effectiveFrom: { $lte: new Date() },
  }).sort({ serviceId: -1 });

  const policy = policies[0];
  let regionalAdjustment = 0;
  let urgentSurchargePercent = 0;

  if (policy) {
    if (policy.modifierType === 'PERCENTAGE') {
      regionalAdjustment = Math.round(baseAmount * (policy.modifierValue / 100) * 100) / 100;
    } else {
      regionalAdjustment = policy.modifierValue;
    }
    urgentSurchargePercent = policy.urgentSurchargePercent ?? 0;
  }

  const subtotal = baseAmount + regionalAdjustment;
  const urgentSurcharge = input.isUrgent
    ? Math.round(subtotal * (urgentSurchargePercent / 100) * 100) / 100
    : 0;
  const discount = input.discount ?? 0;
  const tax = input.taxAmount ?? 0;
  const total = Math.round((subtotal + urgentSurcharge - discount + tax) * 100) / 100;

  return {
    baseAmount,
    regionalAdjustment,
    urgentSurcharge,
    discount,
    tax,
    total,
    currency: input.currency,
  };
}
