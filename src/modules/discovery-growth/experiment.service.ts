import { ExperimentStatus, ExperimentVariant } from '@ghaarfix/shared-types';
import { Experiment } from '@/models/Experiment.js';
import { deterministicBucket } from '@/modules/discovery-growth/hash.util.js';

export async function getVariantForCustomer(customerId: string, experimentKey: string) {
  const experiment = await Experiment.findOne({ key: experimentKey.toLowerCase() });
  if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
    return { variant: ExperimentVariant.CONTROL, experimentKey, enrolled: false };
  }

  const now = new Date();
  if (experiment.startAt && now < experiment.startAt) {
    return { variant: ExperimentVariant.CONTROL, experimentKey, enrolled: false };
  }
  if (experiment.endAt && now > experiment.endAt) {
    return { variant: ExperimentVariant.CONTROL, experimentKey, enrolled: false };
  }

  if (experiment.targeting?.whitelist?.includes(customerId)) {
    return { variant: experiment.variants[1] ?? ExperimentVariant.VARIANT_A, experimentKey, enrolled: true };
  }

  const percentage = experiment.targeting?.percentage ?? 100;
  const bucket = deterministicBucket(customerId, experimentKey);
  if (bucket >= percentage) {
    return { variant: ExperimentVariant.CONTROL, experimentKey, enrolled: false };
  }

  const variantIndex = deterministicBucket(customerId, `${experimentKey}:variant`) % experiment.variants.length;
  return {
    variant: experiment.variants[variantIndex] ?? ExperimentVariant.CONTROL,
    experimentKey,
    enrolled: true,
  };
}

export async function listExperiments() {
  return Experiment.find().sort({ createdAt: -1 });
}

export async function createExperiment(data: Partial<InstanceType<typeof Experiment>>) {
  return Experiment.create(data);
}

export async function updateExperiment(id: string, data: Partial<InstanceType<typeof Experiment>>) {
  return Experiment.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteExperiment(id: string) {
  return Experiment.findByIdAndDelete(id);
}
