import { DEFAULT_CURRENCY, type Money } from '@ghaarfix/shared-types';

export function money(amountMinor: number, currency = DEFAULT_CURRENCY): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('Money amountMinor must be an integer');
  }
  return { amountMinor, currency };
}

export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

export function fromMinor(amountMinor: number): number {
  return amountMinor / 100;
}

export function formatMoney(m: Money): string {
  const major = fromMinor(m.amountMinor);
  return `${m.currency} ${major.toFixed(2)}`;
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function sumMinor(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

export function gatewayFeeMinor(amountMinor: number, rateBps = 200): number {
  return Math.round((amountMinor * rateBps) / 10000);
}
