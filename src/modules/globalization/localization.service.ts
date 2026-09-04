import { Translation } from '@/models/Globalization.js';
import {
  GLOBAL_DEFAULT_LOCALE,
} from '@ghaarfix/shared-types';

const memoryCache = new Map<string, string>();

function cacheKey(key: string, locale: string, regionId?: string): string {
  return `${regionId ?? 'global'}:${locale}:${key}`;
}

export async function translate(
  key: string,
  locale: string,
  regionId?: string,
  params?: Record<string, string | number>,
): Promise<string> {
  const resolved = await resolveTranslation(key, locale, regionId);
  if (!params) return resolved;
  return Object.entries(params).reduce(
    (text, [param, value]) => text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value)),
    resolved,
  );
}

export async function resolveTranslation(
  key: string,
  locale: string,
  regionId?: string,
): Promise<string> {
  const ck = cacheKey(key, locale, regionId);
  const cached = memoryCache.get(ck);
  if (cached) return cached;

  const locales = buildLocaleFallbackChain(locale, regionId);
  for (const loc of locales) {
    const query = regionId
      ? { key, locale: loc, $or: [{ regionId }, { regionId: null }] }
      : { key, locale: loc, regionId: null };
    const row = await Translation.findOne(query).sort({ regionId: -1 });
    if (row?.value) {
      memoryCache.set(ck, row.value);
      return row.value;
    }
  }

  const globalRow = await Translation.findOne({ key, locale: GLOBAL_DEFAULT_LOCALE, regionId: null });
  if (globalRow?.value) return globalRow.value;

  return key.startsWith('booking.') || key.startsWith('common.')
    ? humanizeKey(key)
    : key;
}

function buildLocaleFallbackChain(locale: string, _regionId?: string): string[] {
  const chain = [locale];
  const base = locale.split('-')[0];
  if (base && base !== locale) chain.push(base);
  chain.push(GLOBAL_DEFAULT_LOCALE);
  return chain;
}

function humanizeKey(key: string): string {
  const part = key.split('.').pop() ?? key;
  return part.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatRegionalDate(
  date: Date,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'medium',
    ...options,
  }).format(date);
}

export function formatRegionalNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export async function upsertTranslation(input: {
  key: string;
  locale: string;
  value: string;
  regionId?: string;
}): Promise<void> {
  await Translation.findOneAndUpdate(
    { key: input.key, locale: input.locale, regionId: input.regionId ?? null },
    { value: input.value },
    { upsert: true },
  );
  memoryCache.delete(cacheKey(input.key, input.locale, input.regionId));
}

export function clearTranslationCache(): void {
  memoryCache.clear();
}
