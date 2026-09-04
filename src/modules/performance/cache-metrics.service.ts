import { metricsService } from '@/modules/reliability/metrics.service.js';

const namespaceHits = new Map<string, { hits: number; misses: number; sets: number; errors: number }>();

function getNsStats(namespace: string) {
  let stats = namespaceHits.get(namespace);
  if (!stats) {
    stats = { hits: 0, misses: 0, sets: 0, errors: 0 };
    namespaceHits.set(namespace, stats);
  }
  return stats;
}

function extractNamespace(key: string): string {
  const parts = key.split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : 'unknown';
}

export const cacheMetrics = {
  recordHit(key: string): void {
    const ns = extractNamespace(key);
    getNsStats(ns).hits += 1;
    metricsService.counter('cache_hits_total', 1, { namespace: ns });
  },

  recordMiss(key: string): void {
    const ns = extractNamespace(key);
    getNsStats(ns).misses += 1;
    metricsService.counter('cache_misses_total', 1, { namespace: ns });
  },

  recordSet(key: string): void {
    const ns = extractNamespace(key);
    getNsStats(ns).sets += 1;
    metricsService.counter('cache_sets_total', 1, { namespace: ns });
  },

  recordError(key: string): void {
    const ns = extractNamespace(key);
    getNsStats(ns).errors += 1;
    metricsService.counter('cache_errors_total', 1, { namespace: ns });
  },

  getSnapshot(): Array<{
    namespace: string;
    hits: number;
    misses: number;
    sets: number;
    errors: number;
    hitRate: number;
  }> {
    return Array.from(namespaceHits.entries()).map(([namespace, stats]) => {
      const total = stats.hits + stats.misses;
      return {
        namespace,
        ...stats,
        hitRate: total > 0 ? stats.hits / total : 0,
      };
    });
  },

  reset(): void {
    namespaceHits.clear();
  },
};
