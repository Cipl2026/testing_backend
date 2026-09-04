import { CapacityPlan } from '@/models/Performance.js';
import { CapacityRiskLevel } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { getLatestBaseline } from '@/modules/performance/baseline.service.js';

export async function seedCapacityPlan(): Promise<void> {
  const baseline = await getLatestBaseline();
  await CapacityPlan.findOneAndUpdate(
    { scope: 'platform', environment: env.nodeEnv },
    {
      scope: 'platform',
      environment: env.nodeEnv,
      currentBaseline: {
        apiP95Ms: baseline?.apiP95Ms ?? 300,
        memoryMb: baseline?.memoryMb ?? 256,
        queueLagMs: baseline?.queueLagMs ?? 0,
        cacheHitRate: baseline?.cacheHitRate ?? 0.5,
      },
      expectedGrowthPercent: 25,
      peakTrafficMultiplier: 3,
      riskLevel: CapacityRiskLevel.NORMAL,
      confidence: 0.75,
      recommendedAction: 'Monitor baseline; scale horizontally when API p95 exceeds budget.',
    },
    { upsert: true },
  );
}

export async function getCapacityPlan() {
  return CapacityPlan.findOne({ scope: 'platform', environment: env.nodeEnv });
}

export async function forecastCapacity(): Promise<void> {
  const baseline = await getLatestBaseline();
  if (!baseline) return;

  const plan = await getCapacityPlan();
  if (!plan) return;

  const growthFactor = 1 + plan.expectedGrowthPercent / 100;
  const peakFactor = plan.peakTrafficMultiplier;
  const projectedApiP95 = baseline.apiP95Ms * growthFactor * (peakFactor / 2);
  const projectedMemory = baseline.memoryMb * growthFactor;

  let riskLevel = CapacityRiskLevel.NORMAL;
  let recommendedAction = 'Capacity within normal bounds.';
  let projectedDate: Date | undefined;

  if (projectedApiP95 > 800 || projectedMemory > 1024) {
    riskLevel = CapacityRiskLevel.WARNING;
    recommendedAction = 'Plan horizontal scaling within 90 days.';
    projectedDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  if (projectedApiP95 > 1500 || projectedMemory > 2048) {
    riskLevel = CapacityRiskLevel.CRITICAL;
    recommendedAction = 'Immediate capacity review required.';
    projectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await CapacityPlan.findByIdAndUpdate(plan._id, {
    currentBaseline: {
      apiP95Ms: baseline.apiP95Ms,
      memoryMb: baseline.memoryMb,
      queueLagMs: baseline.queueLagMs,
      cacheHitRate: baseline.cacheHitRate,
    },
    riskLevel,
    projectedCapacityDate: projectedDate,
    recommendedAction,
  });
}
