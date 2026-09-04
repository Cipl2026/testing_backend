import { metricsService } from '@/modules/reliability/metrics.service.js';

export interface ProfilerSpan {
  name: string;
  startMs: number;
  labels?: Record<string, string>;
}

const activeSpans = new Map<string, ProfilerSpan>();

export const performanceProfiler = {
  startSpan(name: string, labels?: Record<string, string>): string {
    const key = `${name}:${Date.now()}:${Math.random()}`;
    activeSpans.set(key, { name, startMs: Date.now(), labels });
    return key;
  },

  endSpan(spanKey: string): number {
    const span = activeSpans.get(spanKey);
    activeSpans.delete(spanKey);
    if (!span) return 0;
    const durationMs = Date.now() - span.startMs;
    metricsService.histogram('perf_span_duration_ms', durationMs, {
      span: span.name,
      ...span.labels,
    });
    if (durationMs > 500) {
      metricsService.counter('perf_slow_span_total', 1, { span: span.name });
    }
    return durationMs;
  },

  async trace<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
    const spanKey = this.startSpan(name, labels);
    try {
      return await fn();
    } finally {
      this.endSpan(spanKey);
    }
  },

  recordDbOperation(collection: string, operation: string, durationMs: number): void {
    metricsService.histogram('db_operation_duration_ms', durationMs, { collection, operation });
    if (durationMs > 200) {
      metricsService.counter('db_slow_operation_total', 1, { collection, operation });
    }
  },

  recordExternalCall(service: string, durationMs: number, success: boolean): void {
    metricsService.histogram('external_call_duration_ms', durationMs, { service });
    if (!success) {
      metricsService.counter('external_call_errors_total', 1, { service });
    }
  },
};
