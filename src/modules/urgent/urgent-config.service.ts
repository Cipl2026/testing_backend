import { env } from '@/config/env.js';
import { UrgentDispatchConfig } from '@/models/UrgentDispatchConfig.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export interface EffectiveDispatchConfig {
  invitationTtlSeconds: number;
  waveIntervalSeconds: number;
  batchSize: number;
  retryCooldownSeconds: number;
  noShowMinutes: number;
  maxRadiusKm: number;
  maxBroadcastProviders: number;
}

const DEFAULTS: EffectiveDispatchConfig = {
  invitationTtlSeconds: env.urgent.invitationTtlSeconds,
  waveIntervalSeconds: env.urgent.waveIntervalSeconds,
  batchSize: env.urgent.batchSize,
  retryCooldownSeconds: env.urgent.retryCooldownSeconds,
  noShowMinutes: env.urgent.noShowMinutes,
  maxRadiusKm: 10,
  maxBroadcastProviders: env.urgent.maxBroadcastProviders,
};

let cache: { at: number; config: EffectiveDispatchConfig } | null = null;
const CACHE_TTL_MS = 30 * 1000;

/**
 * Effective urgent dispatch config = runtime admin overrides layered over env
 * defaults. Cached briefly to avoid a DB read on every dispatch ring.
 */
export async function getDispatchConfig(): Promise<EffectiveDispatchConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.config;

  let doc: {
    invitationTtlSeconds?: number;
    waveIntervalSeconds?: number;
    batchSize?: number;
    retryCooldownSeconds?: number;
    noShowMinutes?: number;
    maxRadiusKm?: number;
    maxBroadcastProviders?: number;
  } | null = null;
  try {
    doc = await UrgentDispatchConfig.findOne({ key: 'global' }).lean();
  } catch {
    // DB unavailable (e.g. during boot) — fall through to defaults.
  }

  const config: EffectiveDispatchConfig = {
    invitationTtlSeconds: doc?.invitationTtlSeconds ?? DEFAULTS.invitationTtlSeconds,
    waveIntervalSeconds: doc?.waveIntervalSeconds ?? DEFAULTS.waveIntervalSeconds,
    batchSize: doc?.batchSize ?? DEFAULTS.batchSize,
    retryCooldownSeconds: doc?.retryCooldownSeconds ?? DEFAULTS.retryCooldownSeconds,
    noShowMinutes: doc?.noShowMinutes ?? DEFAULTS.noShowMinutes,
    maxRadiusKm: doc?.maxRadiusKm ?? DEFAULTS.maxRadiusKm,
    maxBroadcastProviders: doc?.maxBroadcastProviders ?? DEFAULTS.maxBroadcastProviders,
  };

  cache = { at: Date.now(), config };
  return config;
}

export async function updateDispatchConfig(
  adminId: string,
  patch: Partial<EffectiveDispatchConfig>,
): Promise<EffectiveDispatchConfig> {
  const cleaned: Record<string, number> = {};
  const allowedKeys: Array<keyof EffectiveDispatchConfig> = [
    'invitationTtlSeconds',
    'waveIntervalSeconds',
    'batchSize',
    'retryCooldownSeconds',
    'noShowMinutes',
    'maxRadiusKm',
    'maxBroadcastProviders',
  ];
  for (const key of allowedKeys) {
    const value = patch[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      cleaned[key] = value;
    }
  }
  if (!Object.keys(cleaned).length) {
    throw new AppError(
      'No valid dispatch configuration values provided.',
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  await UrgentDispatchConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: { ...cleaned, updatedBy: adminId } },
    { upsert: true },
  );
  cache = null;
  return getDispatchConfig();
}