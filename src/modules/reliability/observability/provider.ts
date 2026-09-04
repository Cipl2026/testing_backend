import { createHash, randomUUID } from 'node:crypto';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';
import {
  getObservabilityContext,
  runWithObservabilityContext,
} from '@/modules/reliability/observability/context-store.js';
import type { ObservabilityProvider, TraceSpan } from './types.js';
import type { LogMeta } from './types.js';

export type { LogMeta };

class NoopTraceSpan implements TraceSpan {
  traceId: string;
  spanId: string;

  constructor(traceId: string, spanId: string) {
    this.traceId = traceId;
    this.spanId = spanId;
  }

  end(): void {
    // no-op
  }
}

export class NoopObservabilityProvider implements ObservabilityProvider {
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void {
    logger[level](message, meta);
  }

  recordMetric(_name: string, _value: number, _labels?: Record<string, string>): void {
    // metrics collected in MetricsService
  }

  recordException(error: unknown, context?: LogMeta): void {
    logger.error('Exception recorded', { error, ...context });
  }

  startTrace(name: string): TraceSpan {
    const ctx = getObservabilityContext();
    const traceId = ctx.traceId ?? randomUUID();
    const spanId = randomUUID().slice(0, 16);
    logger.debug('Trace started', { trace: name, traceId, spanId });
    return new NoopTraceSpan(traceId, spanId);
  }

  addTraceEvent(name: string, attributes?: Record<string, string>): void {
    logger.debug('Trace event', { event: name, ...attributes });
  }

  setTraceAttribute(key: string, value: string): void {
    logger.debug('Trace attribute', { key, value });
  }
}

export class CompositeObservabilityProvider implements ObservabilityProvider {
  constructor(private readonly inner: ObservabilityProvider) {}

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void {
    const ctx = getObservabilityContext();
    const enriched: LogMeta = {
      service: 'ghaarfix-api',
      environment: env.nodeEnv,
      traceId: ctx.traceId,
      requestId: ctx.requestId,
      ...meta,
    };
    this.inner.log(level, message, enriched);
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.inner.recordMetric(name, value, labels);
  }

  recordException(error: unknown, context?: LogMeta): void {
    const ctx = getObservabilityContext();
    this.inner.recordException(error, {
      ...context,
      traceId: ctx.traceId,
      requestId: ctx.requestId,
      environment: env.nodeEnv,
      releaseVersion: env.release.version,
    });
  }

  startTrace(name: string): TraceSpan {
    return this.inner.startTrace(name);
  }

  addTraceEvent(name: string, attributes?: Record<string, string>): void {
    this.inner.addTraceEvent(name, attributes);
  }

  setTraceAttribute(key: string, value: string): void {
    this.inner.setTraceAttribute(key, value);
  }
}

let provider: ObservabilityProvider = new CompositeObservabilityProvider(
  new NoopObservabilityProvider(),
);

export function getObservabilityProvider(): ObservabilityProvider {
  return provider;
}

export function setObservabilityProvider(next: ObservabilityProvider): void {
  provider = next;
}

export function runWithTraceContext<T>(traceId: string, fn: () => T): T {
  return runWithObservabilityContext({ traceId, requestId: traceId }, fn);
}

export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

export function getActiveTraceContext(): { traceId?: string; spanId?: string } {
  const ctx = getObservabilityContext();
  return { traceId: ctx.traceId, spanId: undefined };
}
