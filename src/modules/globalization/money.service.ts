import type { Money } from '@ghaarfix/shared-types';

const CURRENCY_DECIMALS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  AED: 2,
};

export function getCurrencyDecimals(currencyCode: string): number {
  return CURRENCY_DECIMALS[currencyCode.toUpperCase()] ?? 2;
}

export function toMinorUnits(amountMajor: number, currencyCode: string): number {
  const decimals = getCurrencyDecimals(currencyCode);
  return Math.round(amountMajor * 10 ** decimals);
}

export function fromMinorUnits(amountMinor: number, currencyCode: string): number {
  const decimals = getCurrencyDecimals(currencyCode);
  return amountMinor / 10 ** decimals;
}

export function createMoney(amountMajor: number, currencyCode: string): Money {
  return {
    amountMinor: toMinorUnits(amountMajor, currencyCode),
    currency: currencyCode.toUpperCase(),
  };
}

export function formatMoney(money: Money, locale = 'en'): string {
  const major = fromMinorUnits(money.amountMinor, money.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(major);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error('Cannot add money in different currencies');
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
