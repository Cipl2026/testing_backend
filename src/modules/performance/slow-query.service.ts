import { createHash } from 'node:crypto';
import { SlowQueryRecord } from '@/models/Performance.js';
import { performanceProfiler } from '@/modules/performance/performance-profiler.service.js';
import { isScalePerformanceEnabled } from '@/modules/performance/performance-feature.service.js';

const SLOW_QUERY_THRESHOLD_MS = 200;
const PII_PATTERNS = [
  /\b[0-9a-f]{24}\b/gi,
  /\b\d{10,12}\b/g,
  /@[\w.-]+\.\w+/g,
];

export function fingerprintQuery(collection: string, filter: unknown): string {
  const normalized = normalizeQuery(filter);
  const raw = `${collection}:${JSON.stringify(normalized)}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function normalizeQuery(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(normalizeQuery);
  if (value instanceof Date) return '?';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === '_id' || key.endsWith('Id') || key.endsWith('ID')) {
        out[key] = '?';
      } else if (typeof val === 'string' || typeof val === 'number') {
        out[key] = '?';
      } else {
        out[key] = normalizeQuery(val);
      }
    }
    return out;
  }
  return '?';
}

export function redactQueryString(query: string): string {
  let redacted = query;
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern, '?');
  }
  return redacted;
}

export async function recordSlowQuery(input: {
  operation: string;
  collection: string;
  filter?: unknown;
  durationMs: number;
  documentsExamined?: number;
  keysExamined?: number;
  returnedCount?: number;
}): Promise<void> {
  performanceProfiler.recordDbOperation(input.collection, input.operation, input.durationMs);
  if (input.durationMs < SLOW_QUERY_THRESHOLD_MS) return;
  if (!(await isScalePerformanceEnabled())) return;

  await SlowQueryRecord.create({
    operation: input.operation,
    collectionName: input.collection,
    queryFingerprint: fingerprintQuery(input.collection, input.filter ?? {}),
    durationMs: input.durationMs,
    documentsExamined: input.documentsExamined,
    keysExamined: input.keysExamined,
    returnedCount: input.returnedCount,
    timestamp: new Date(),
  });
}

export async function listSlowQueries(limit = 50, collection?: string) {
  const query = collection ? { collectionName: collection } : {};
  const rows = await SlowQueryRecord.find(query).sort({ timestamp: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    operation: r.operation,
    collection: r.collectionName,
    queryFingerprint: r.queryFingerprint,
    durationMs: r.durationMs,
    documentsExamined: r.documentsExamined,
    keysExamined: r.keysExamined,
    returnedCount: r.returnedCount,
    timestamp: r.timestamp,
  }));
}

export async function aggregateSlowQueryFingerprints(limit = 20) {
  return SlowQueryRecord.aggregate([
    {
      $group: {
        _id: { collection: '$collectionName', fingerprint: '$queryFingerprint' },
        count: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' },
        maxDurationMs: { $max: '$durationMs' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}
