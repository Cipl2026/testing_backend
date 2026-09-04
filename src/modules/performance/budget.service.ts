import { PerformanceBudget } from '@/models/Performance.js';
import { PerformanceBudgetMetric } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';

const DEFAULT_BUDGETS = [
  {
    resource: 'api',
    metric: PerformanceBudgetMetric.API_P95_MS,
    target: 300,
    warningThreshold: 500,
    criticalThreshold: 1000,
  },
  {
    resource: 'api',
    metric: PerformanceBudgetMetric.ERROR_RATE,
    target: 0.01,
    warningThreshold: 0.03,
    criticalThreshold: 0.05,
  },
  {
    resource: 'database',
    metric: PerformanceBudgetMetric.DB_QUERY_P95_MS,
    target: 100,
    warningThreshold: 200,
    criticalThreshold: 500,
  },
  {
    resource: 'cache',
    metric: PerformanceBudgetMetric.CACHE_HIT_RATE,
    target: 0.8,
    warningThreshold: 0.6,
    criticalThreshold: 0.4,
  },
  {
    resource: 'queue',
    metric: PerformanceBudgetMetric.QUEUE_LAG_MS,
    target: 5000,
    warningThreshold: 15000,
    criticalThreshold: 60000,
  },
];

export async function seedPerformanceBudgets(): Promise<void> {
  for (const budget of DEFAULT_BUDGETS) {
    await PerformanceBudget.findOneAndUpdate(
      { environment: env.nodeEnv, resource: budget.resource, metric: budget.metric },
      { ...budget, environment: env.nodeEnv, owner: 'Platform Team' },
      { upsert: true },
    );
  }
}

export async function listPerformanceBudgets() {
  return PerformanceBudget.find({ environment: env.nodeEnv });
}

export function evaluateBudget(
  metric: PerformanceBudgetMetric,
  value: number,
  budget: { target: number; warningThreshold: number; criticalThreshold: number },
): 'ok' | 'warning' | 'critical' {
  const higherIsBetter = metric === PerformanceBudgetMetric.CACHE_HIT_RATE;
  if (higherIsBetter) {
    if (value < budget.criticalThreshold) return 'critical';
    if (value < budget.warningThreshold) return 'warning';
    return 'ok';
  }
  if (value >= budget.criticalThreshold) return 'critical';
  if (value >= budget.warningThreshold) return 'warning';
  return 'ok';
}
