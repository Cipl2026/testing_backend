import { describe, expect, it } from 'vitest';
import { resolveHomeHelpBundleDiscount } from '@/modules/home-help/home-help-pricing.service.js';

describe('home-help-pricing.service', () => {
  it('returns no discount below 3 tasks', () => {
    expect(resolveHomeHelpBundleDiscount(2, 200)).toEqual({
      discountAmount: 0,
      label: undefined,
      percent: 0,
    });
  });

  it('applies 10% discount on add-ons for 3+ tasks', () => {
    const result = resolveHomeHelpBundleDiscount(3, 200);
    expect(result.discountAmount).toBe(20);
    expect(result.percent).toBe(10);
    expect(result.label).toMatch(/3\+ tasks/i);
  });

  it('applies 15% discount on add-ons for 5+ tasks', () => {
    const result = resolveHomeHelpBundleDiscount(5, 300);
    expect(result.discountAmount).toBe(45);
    expect(result.percent).toBe(15);
  });

  it('ignores discount when add-on total is zero', () => {
    expect(resolveHomeHelpBundleDiscount(5, 0).discountAmount).toBe(0);
  });
});
