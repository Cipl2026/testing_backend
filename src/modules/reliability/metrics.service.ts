import { createHash } from 'node:crypto';

type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

interface MetricEntry {
  type: MetricType;
  values: number[];
  sum: number;
  count: number;
  labels: Record<string, string>;
}

const FORBIDDEN_LABELS = new Set([
  'userid',
  'customerid',
  'bookingid',
  'providerid',
  'organizationid',
  'phone',
  'email',
]);

const metrics = new Map<string, MetricEntry>();
const timers = new Map<string, number>();

function metricKey(name: string, labels?: Record<string, string>): string {
  const safeLabels = sanitizeLabels(labels);
  const labelStr = Object.entries(safeLabels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
}

function sanitizeLabels(labels?: Record<string, string>): Record<string, string> {
  if (!labels) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (FORBIDDEN_LABELS.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

function getOrCreate(name: string, type: MetricType, labels?: Record<string, string>): MetricEntry {
  const key = metricKey(name, labels);
  let entry = metrics.get(key);
  if (!entry) {
    entry = { type, values: [], sum: 0, count: 0, labels: sanitizeLabels(labels) ?? {} };
    metrics.set(key, entry);
  }
  return entry;
}

export const metricsService = {
  counter(name: string, value = 1, labels?: Record<string, string>): void {
    const entry = getOrCreate(name, 'counter', labels);
    entry.sum += value;
    entry.count += 1;
  },

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const entry = getOrCreate(name, 'gauge', labels);
    entry.sum = value;
    entry.count = 1;
    entry.values = [value];
  },

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const entry = getOrCreate(name, 'histogram', labels);
    entry.values.push(value);
    entry.sum += value;
    entry.count += 1;
    if (entry.values.length > 10000) entry.values = entry.values.slice(-5000);
  },

  startTimer(name: string, labels?: Record<string, string>): string {
    const key = `${metricKey(name, labels)}:${Date.now()}:${Math.random()}`;
    timers.set(key, Date.now());
    return key;
  },

  endTimer(timerKey: string): number {
    const start = timers.get(timerKey);
    timers.delete(timerKey);
    if (!start) return 0;
    return Date.now() - start;
  },

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route: normalizeRoute(route), status: String(statusCode) };
    this.counter('http_requests_total', 1, labels);
    this.histogram('http_request_duration_ms', durationMs, { method, route: labels.route });
    if (statusCode >= 500) {
      this.counter('http_errors_total', 1, { method, route: labels.route });
    }
  },

  recordBusinessEvent(event: string, labels?: Record<string, string>): void {
    this.counter(`business_${event}`, 1, labels);
  },

  getSnapshot(): {
    counters: Array<{ name: string; value: number; labels: Record<string, string> }>;
    histograms: Array<{
      name: string;
      count: number;
      p50: number;
      p95: number;
      p99: number;
      labels: Record<string, string>;
    }>;
    gauges: Array<{ name: string; value: number; labels: Record<string, string> }>;
  } {
    const counters: Array<{ name: string; value: number; labels: Record<string, string> }> = [];
    const histograms: Array<{
      name: string;
      count: number;
      p50: number;
      p95: number;
      p99: number;
      labels: Record<string, string>;
    }> = [];
    const gauges: Array<{ name: string; value: number; labels: Record<string, string> }> = [];

    for (const [key, entry] of metrics) {
      const name = key.split('{')[0];
      if (entry.type === 'counter') {
        counters.push({ name, value: entry.sum, labels: entry.labels });
      } else if (entry.type === 'gauge') {
        gauges.push({ name, value: entry.sum, labels: entry.labels });
      } else if (entry.type === 'histogram' || entry.type === 'timer') {
        const sorted = [...entry.values].sort((a, b) => a - b);
        histograms.push({
          name,
          count: entry.count,
          p50: percentile(sorted, 0.5),
          p95: percentile(sorted, 0.95),
          p99: percentile(sorted, 0.99),
          labels: entry.labels,
        });
      }
    }

    return { counters, histograms, gauges };
  },

  reset(): void {
    metrics.clear();
    timers.clear();
  },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function normalizeRoute(route: string): string {
  return route
    .replace(/\/[a-f0-9]{24}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

export function buildErrorDeduplicationKey(
  errorCode: string,
  message: string,
  stack?: string,
  release?: string,
): string {
  const normalized = `${errorCode}|${message.slice(0, 200)}|${stack ?? ''}|${release ?? ''}`;
  return createHash('sha256').update(normalized).digest('hex');
}
