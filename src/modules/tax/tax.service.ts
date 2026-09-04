import { env } from '@/config/env.js';

export interface TaxBreakdown {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export function calculateTax(subtotal: number): TaxBreakdown {
  const taxRate = env.tax.ratePercent / 100;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  return {
    subtotal,
    taxRate: env.tax.ratePercent,
    taxAmount,
    total: Math.round((subtotal + taxAmount) * 100) / 100,
  };
}
