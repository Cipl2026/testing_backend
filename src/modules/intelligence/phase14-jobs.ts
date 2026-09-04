import { processPendingImageJobs } from '@/modules/intelligence/issue-classification/issue-classification.service.js';
import { runAnomalyDetection } from '@/modules/intelligence/anomaly-detection/anomaly-detection.service.js';
import { generateDemandForecasts } from '@/modules/intelligence/demand-forecasting/demand-forecast.service.js';
import { seedIntelligenceModels } from '@/modules/intelligence/evaluation/model-registry.service.js';
import { logger } from '@/utils/logger.js';

let initialized = false;

export async function runPhase14Jobs() {
  if (!initialized) {
    await seedIntelligenceModels();
    initialized = true;
  }

  const [images, anomalies, forecasts] = await Promise.all([
    processPendingImageJobs().catch((e) => {
      logger.error('Phase14 image jobs failed', { error: e });
      return 0;
    }),
    runAnomalyDetection().catch((e) => {
      logger.error('Phase14 anomaly detection failed', { error: e });
      return 0;
    }),
    generateDemandForecasts().catch((e) => {
      logger.error('Phase14 demand forecast failed', { error: e });
      return 0;
    }),
  ]);

  return { images, anomalies, forecasts };
}
