import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(serverRoot, '.env') });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CLIENT_URL: z.string().min(1, 'CLIENT_URL is required'),
  ADMIN_URL: z.string().min(1, 'ADMIN_URL is required'),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
  EXPOSE_OTP_IN_RESPONSE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  SLOT_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  DEFAULT_BUFFER_MINUTES: z.coerce.number().int().min(0).default(15),
  MAX_ADVANCE_BOOKING_DAYS: z.coerce.number().int().positive().default(30),
  MIN_BOOKING_NOTICE_MINUTES: z.coerce.number().int().min(0).default(60),
  SLOT_RESERVATION_MINUTES: z.coerce.number().int().positive().default(10),
  PROVIDER_RESPONSE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(10),
  PROVIDER_CONFIRM_REMINDER_24H_HOURS: z.coerce.number().positive().default(24),
  PROVIDER_CONFIRM_REMINDER_2H_HOURS: z.coerce.number().positive().default(2),
  PROVIDER_CONFIRM_DEADLINE_HOURS: z.coerce.number().positive().default(1),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  URGENT_REQUEST_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(600),
  URGENT_WAVE_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  URGENT_INVITATION_TTL_SECONDS: z.coerce.number().int().positive().default(45),
  URGENT_MAX_BROADCAST_PROVIDERS: z.coerce.number().int().positive().default(10),
  URGENT_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(3),
  URGENT_RETRY_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  PRESENCE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(3),
  PRESENCE_HEARTBEAT_SECONDS: z.coerce.number().int().positive().default(45),
  MAX_PROVIDER_LOCATION_AGE_MINUTES: z.coerce.number().int().positive().default(5),
  URGENT_MAX_ACTIVE_JOBS_PER_PROVIDER: z.coerce.number().int().positive().default(1),
  URGENT_NO_SHOW_MINUTES: z.coerce.number().int().positive().default(20),
  URGENT_BATCH_SIZE: z.coerce.number().int().positive().default(3),
  // Phase 7 — tracking
  MIN_HISTORY_DISTANCE_METERS: z.coerce.number().int().positive().default(100),
  MIN_HISTORY_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  MAX_LOCATION_AGE_MINUTES: z.coerce.number().int().positive().default(5),
  LOCATION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  ETA_REFRESH_SECONDS: z.coerce.number().int().positive().default(120),
  ETA_DISTANCE_THRESHOLD_METERS: z.coerce.number().int().positive().default(300),
  // Phase 7 — storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(5),
  DO_SPACES_KEY: z.string().optional(),
  DO_SPACES_SECRET: z.string().optional(),
  /** Legacy aliases used in some deployments */
  DO_SPACES_ACCESS_KEY: z.string().optional(),
  DO_SPACES_SECRET_KEY: z.string().optional(),
  DO_SPACES_REGION: z.string().optional(),
  DO_SPACES_BUCKET: z.string().optional(),
  DO_SPACES_ENDPOINT: z.string().url().optional(),
  DO_SPACES_CDN_BASE: z.string().url().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  AI_PROVIDER: z.enum(['RULE_BASED', 'GEMINI', 'EXTERNAL']).default('GEMINI'),
  // Phase 7 — maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  // Phase 7 — tax
  TAX_RATE_PERCENT: z.coerce.number().min(0).default(0),
  // Phase 7 — reviews
  REVIEW_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
  REVIEW_REMINDER_DELAY_HOURS: z.coerce.number().int().positive().default(2),
  // Nimbus SMS (OTP)
  NIMBUS_USER: z.string().optional(),
  NIMBUS_AUTHKEY: z.string().optional(),
  NIMBUS_SENDER: z.string().optional(),
  NIMBUS_ENTITY_ID: z.string().optional(),
  NIMBUS_TEMPLATE_ID: z.string().optional(),
  // Phase 11 — operations & scale
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('error'),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  GRACEFUL_SHUTDOWN_MS: z.coerce.number().int().positive().default(10000),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  APP_VERSION: z.string().default('1.0.0'),
  GIT_COMMIT: z.string().optional(),
  BUILD_TIMESTAMP: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = parsed.data;
  const isProd = data.NODE_ENV === 'production';

  const configuredCorsOrigins = [...data.CLIENT_URL.split(','), ...data.ADMIN_URL.split(',')]
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Local dev can land on any free port: Vite picks 5173/5174/5175… as new
  // ports get occupied and Expo serves the mobile apps on 8081/8082.
  // Auto-allow the standard localhost origins outside production so CORS never
  // breaks just because the dev port shifted.
  const devLocalOrigins = isProd
    ? []
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:8081',
        'http://localhost:8082',
      ];

  const corsOrigins = [...new Set([...configuredCorsOrigins, ...devLocalOrigins])];

  return {
    nodeEnv: data.NODE_ENV,
    isProd,
    isTest: data.NODE_ENV === 'test',
    port: data.PORT,
    mongodbUri: data.MONGODB_URI,
    jwt: {
      accessSecret: data.JWT_ACCESS_SECRET,
      refreshSecret: data.JWT_REFRESH_SECRET,
      accessExpiry: data.JWT_ACCESS_EXPIRY,
      refreshExpiry: data.JWT_REFRESH_EXPIRY,
    },
    clientUrl: data.CLIENT_URL,
    adminUrl: data.ADMIN_URL,
    corsOrigins,
    otp: {
      length: data.OTP_LENGTH,
      expiryMinutes: data.OTP_EXPIRY_MINUTES,
      maxAttempts: data.OTP_MAX_ATTEMPTS,
      resendCooldownSeconds: data.OTP_RESEND_COOLDOWN_SECONDS,
      exposeInResponse: (data.EXPOSE_OTP_IN_RESPONSE ?? false) && !isProd,
      rateLimitMax: data.OTP_RATE_LIMIT_MAX,
    },
    admin: {
      email: data.ADMIN_EMAIL ?? 'admin@ghaarfix.in',
      password: data.ADMIN_PASSWORD ?? 'Admin@123456',
    },
    availability: {
      slotIntervalMinutes: data.SLOT_INTERVAL_MINUTES,
      defaultBufferMinutes: data.DEFAULT_BUFFER_MINUTES,
      maxAdvanceBookingDays: data.MAX_ADVANCE_BOOKING_DAYS,
      minBookingNoticeMinutes: data.MIN_BOOKING_NOTICE_MINUTES,
      slotReservationMinutes: data.SLOT_RESERVATION_MINUTES,
    },
    booking: {
      providerResponseTimeoutMinutes: data.PROVIDER_RESPONSE_TIMEOUT_MINUTES,
      providerConfirmation: {
        reminder24hHours: data.PROVIDER_CONFIRM_REMINDER_24H_HOURS,
        reminder2hHours: data.PROVIDER_CONFIRM_REMINDER_2H_HOURS,
        deadlineHours: data.PROVIDER_CONFIRM_DEADLINE_HOURS,
      },
    },
    razorpay: {
      keyId: data.RAZORPAY_KEY_ID ?? '',
      keySecret: data.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: data.RAZORPAY_WEBHOOK_SECRET ?? '',
    },
    urgent: {
      requestTimeoutSeconds: data.URGENT_REQUEST_TIMEOUT_SECONDS,
      waveIntervalSeconds: data.URGENT_WAVE_INTERVAL_SECONDS,
      invitationTtlSeconds: data.URGENT_INVITATION_TTL_SECONDS,
      maxBroadcastProviders: data.URGENT_MAX_BROADCAST_PROVIDERS,
      requestsPerHour: data.URGENT_REQUESTS_PER_HOUR,
      retryCooldownSeconds: data.URGENT_RETRY_COOLDOWN_SECONDS,
      presenceTimeoutMinutes: data.PRESENCE_TIMEOUT_MINUTES,
      heartbeatSeconds: data.PRESENCE_HEARTBEAT_SECONDS,
      maxProviderLocationAgeMinutes: data.MAX_PROVIDER_LOCATION_AGE_MINUTES,
      maxActiveJobsPerProvider: data.URGENT_MAX_ACTIVE_JOBS_PER_PROVIDER,
      noShowMinutes: data.URGENT_NO_SHOW_MINUTES,
      batchSize: data.URGENT_BATCH_SIZE,
    },
    tracking: {
      minHistoryDistanceMeters: data.MIN_HISTORY_DISTANCE_METERS,
      minHistoryIntervalSeconds: data.MIN_HISTORY_INTERVAL_SECONDS,
      maxLocationAgeMinutes: data.MAX_LOCATION_AGE_MINUTES,
      locationRetentionDays: data.LOCATION_RETENTION_DAYS,
      etaRefreshSeconds: data.ETA_REFRESH_SECONDS,
      etaDistanceThresholdMeters: data.ETA_DISTANCE_THRESHOLD_METERS,
    },
    storage: {
      uploadDir: data.UPLOAD_DIR,
      maxFileSizeBytes: data.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    },
    spaces: {
      accessKey: data.DO_SPACES_KEY ?? data.DO_SPACES_ACCESS_KEY,
      secretKey: data.DO_SPACES_SECRET ?? data.DO_SPACES_SECRET_KEY,
      region: data.DO_SPACES_REGION ?? 'blr1',
      bucket: data.DO_SPACES_BUCKET,
      endpoint:
        data.DO_SPACES_ENDPOINT ??
        (data.DO_SPACES_REGION ? `https://${data.DO_SPACES_REGION}.digitaloceanspaces.com` : undefined),
      cdnBase: data.DO_SPACES_CDN_BASE,
    },
    maps: {
      googleApiKey: data.GOOGLE_MAPS_API_KEY ?? '',
    },
    tax: {
      ratePercent: data.TAX_RATE_PERCENT,
    },
    review: {
      windowDays: data.REVIEW_WINDOW_DAYS,
      reminderDelayHours: data.REVIEW_REMINDER_DELAY_HOURS,
    },
    nimbus: {
      user: data.NIMBUS_USER ?? '',
      authKey: data.NIMBUS_AUTHKEY ?? '',
      sender: data.NIMBUS_SENDER ?? '',
      entityId: data.NIMBUS_ENTITY_ID ?? '',
      templateId: data.NIMBUS_TEMPLATE_ID ?? '',
    },
    redis: {
      url: data.REDIS_URL,
      enabled: (data.REDIS_ENABLED ?? false) && Boolean(data.REDIS_URL),
    },
    logLevel: data.LOG_LEVEL,
    queue: {
      concurrency: data.QUEUE_CONCURRENCY,
    },
    gracefulShutdownMs: data.GRACEFUL_SHUTDOWN_MS,
    cache: {
      ttlSeconds: data.CACHE_TTL_SECONDS,
    },
    gemini: {
      apiKey: data.GEMINI_API_KEY ?? '',
      model: resolveGeminiModel(data.GEMINI_MODEL),
    },
    aiProvider: data.AI_PROVIDER,
    release: {
      version: data.APP_VERSION,
      commit: data.GIT_COMMIT ?? 'unknown',
      buildTimestamp: data.BUILD_TIMESTAMP ?? new Date().toISOString(),
    },
  } as const;
}

/** Free-tier flash models exhaust quickly — always prefer lite in dev. */
function resolveGeminiModel(configured: string): string {
  const deprecatedOrHeavy = new Set([
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ]);
  if (deprecatedOrHeavy.has(configured)) {
    return 'gemini-3.5-flash-lite';
  }
  return configured;
}

export const env = loadEnv();
