import {
  IntelligenceFeature,
  IntelligenceModelStatus,
} from '@ghaarfix/shared-types';
import { IntelligenceModelVersion } from '@/models/Intelligence.js';

const DEFAULT_MODELS: Array<{
  feature: IntelligenceFeature;
  provider: string;
  modelName: string;
  version: string;
}> = [
  {
    feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
    provider: 'RULE_BASED',
    modelName: 'ghaarfix-rules-v1',
    version: '1.0.0',
  },
  {
    feature: IntelligenceFeature.IMAGE_ANALYSIS,
    provider: 'RULE_BASED',
    modelName: 'ghaarfix-image-heuristic-v1',
    version: '1.0.0',
  },
  {
    feature: IntelligenceFeature.PREDICTIVE_MAINTENANCE,
    provider: 'RULE_BASED',
    modelName: 'ghaarfix-maintenance-rules-v1',
    version: '1.0.0',
  },
  {
    feature: IntelligenceFeature.SMART_PROVIDER_MATCHING,
    provider: 'RULE_BASED',
    modelName: 'smart-match-v1',
    version: '1.0.0',
  },
  {
    feature: IntelligenceFeature.DEMAND_FORECAST,
    provider: 'RULE_BASED',
    modelName: 'demand-forecast-rules-v1',
    version: '1.0.0',
  },
  {
    feature: IntelligenceFeature.SUPPORT_ASSISTANT,
    provider: 'RULE_BASED',
    modelName: 'ghaarfix-assistant-v1',
    version: '1.0.0',
  },
];

export async function seedIntelligenceModels() {
  for (const model of DEFAULT_MODELS) {
    await IntelligenceModelVersion.findOneAndUpdate(
      { feature: model.feature, version: model.version },
      {
        ...model,
        status: IntelligenceModelStatus.ACTIVE,
        activatedAt: new Date(),
        metrics: { accuracy: 0, calibration: 0 },
      },
      { upsert: true },
    );
  }
}

export async function listModels() {
  const models = await IntelligenceModelVersion.find().sort({ feature: 1, version: -1 });
  return models.map((m) => ({
    id: m._id.toString(),
    feature: m.feature,
    provider: m.provider,
    modelName: m.modelName,
    version: m.version,
    status: m.status,
    metrics: m.metrics,
    activatedAt: m.activatedAt,
  }));
}

export async function activateModel(modelId: string) {
  const model = await IntelligenceModelVersion.findById(modelId);
  if (!model) return null;

  await IntelligenceModelVersion.updateMany(
    { feature: model.feature, _id: { $ne: model._id } },
    { status: IntelligenceModelStatus.DEPRECATED },
  );

  model.status = IntelligenceModelStatus.ACTIVE;
  model.activatedAt = new Date();
  await model.save();
  return model;
}
