import { getObservabilityContext } from '@/modules/reliability/observability/context-store.js';
import { redactValue } from '@/modules/reliability/log-redaction.service.js';
import { env } from '@/config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const QUIET_INFO_PATTERNS = [
  /^MongoDB connected$/,
  /^MongoDB disconnected$/,
  /^Phase \d+/,
  /^Ran Phase/,
  /^Redis connected$/,
  /^BullMQ queues/,
  /^Socket (connected|disconnected)/,
  /^Request completed$/,
];

function configuredLevel(): LogLevel {
  return env.logLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[configuredLevel()];
}

function isPretty(): boolean {
  return !env.isProd && env.nodeEnv !== 'test';
}

function buildStructuredPayload(
  level: LogLevel,
  message: string,
  meta?: LogMeta,
): Record<string, unknown> {
  const ctx = getObservabilityContext();
  const redacted = redactValue(meta ?? {}) as LogMeta;
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'ghaarfix-api',
    environment: env.nodeEnv,
    releaseVersion: env.release.version,
    requestId: ctx.requestId ?? redacted.requestId,
    traceId: ctx.traceId ?? redacted.traceId,
    userType: redacted.userType,
    userIdHash: redacted.userIdHash,
    bookingId: redacted.bookingId,
    providerId: redacted.providerId,
    organizationId: redacted.organizationId,
    errorCode: redacted.errorCode,
    ...redacted,
  };
}

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  if (!shouldLog(level)) return;

  if (isPretty()) {
    const icons: Record<LogLevel, string> = {
      debug: '·',
      info: '✓',
      warn: '⚠',
      error: '✗',
    };
    const line = `${icons[level]} ${message}`;
    if (level === 'error') {
      console.error(line, meta?.error instanceof Error ? meta.error.message : '');
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
    return;
  }

  const payload = buildStructuredPayload(level, message, meta);
  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }
  console.log(JSON.stringify(payload));
}

function resolveInfoLevel(message: string): LogLevel {
  if (isPretty() && QUIET_INFO_PATTERNS.some((pattern) => pattern.test(message))) {
    return 'debug';
  }
  return 'info';
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    write('debug', message, meta);
  },
  info(message: string, meta?: LogMeta): void {
    write(resolveInfoLevel(message), message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    write('warn', message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    write('error', message, meta);
  },
  startup(message: string): void {
    if (isPretty()) {
      console.log(`\n  🚀 ${message}\n`);
      return;
    }
    write('info', message);
  },
};
