import { ExperimentStatus, ExperimentVariant } from '@ghaarfix/shared-types';
import { Experiment } from '@/models/Experiment.js';
import { ExperimentAssignment } from '@/models/CustomerLifecycle.js';
import { deterministicBucket } from '@/modules/discovery-growth/hash.util.js';

export async function getOrAssignExperimentVariant(customerId: string, experimentKey: string) {
  const experiment = await Experiment.findOne({ key: experimentKey.toLowerCase() });
  if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
    return { variant: ExperimentVariant.CONTROL, enrolled: false, experimentKey };
  }

  const existing = await ExperimentAssignment.findOne({
    experimentId: experiment._id,
    customerId,
  });
  if (existing) {
    return { variant: existing.variant as ExperimentVariant, enrolled: true, experimentKey };
  }

  const now = new Date();
  if (experiment.startAt && now < experiment.startAt) {
    return { variant: ExperimentVariant.CONTROL, enrolled: false, experimentKey };
  }
  if (experiment.endAt && now > experiment.endAt) {
    return { variant: ExperimentVariant.CONTROL, enrolled: false, experimentKey };
  }

  const percentage = experiment.targeting?.percentage ?? 100;
  const bucket = deterministicBucket(customerId, experimentKey);
  if (bucket >= percentage) {
    return { variant: ExperimentVariant.CONTROL, enrolled: false, experimentKey };
  }

  const variantIndex = deterministicBucket(customerId, `${experimentKey}:variant`) % experiment.variants.length;
  const variant = experiment.variants[variantIndex] ?? ExperimentVariant.CONTROL;

  try {
    await ExperimentAssignment.create({
      experimentId: experiment._id,
      customerId,
      variant,
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      const dup = await ExperimentAssignment.findOne({ experimentId: experiment._id, customerId });
      if (dup) return { variant: dup.variant as ExperimentVariant, enrolled: true, experimentKey };
    }
    throw err;
  }

  return { variant, enrolled: true, experimentKey };
}

export async function getExperimentResults(experimentId: string) {
  const assignments = await ExperimentAssignment.aggregate([
    { $match: { experimentId: experimentId as never } },
    { $group: { _id: '$variant', count: { $sum: 1 } } },
  ]);

  return {
    experimentId,
    variants: assignments,
    note: 'Requires minimum sample size and duration before declaring winner.',
  };
}
