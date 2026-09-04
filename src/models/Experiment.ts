import mongoose, { type Document, Schema } from 'mongoose';
import { ExperimentStatus, ExperimentVariant } from '@ghaarfix/shared-types';

export interface ExperimentTargeting {
  percentage?: number;
  whitelist?: string[];
}

export interface IExperiment extends Document {
  key: string;
  name: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  targeting?: ExperimentTargeting;
  startAt?: Date;
  endAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const experimentSchema = new Schema<IExperiment>(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ExperimentStatus),
      default: ExperimentStatus.DRAFT,
      index: true,
    },
    variants: {
      type: [String],
      enum: Object.values(ExperimentVariant),
      default: [ExperimentVariant.CONTROL, ExperimentVariant.VARIANT_A],
    },
    targeting: {
      percentage: Number,
      whitelist: [String],
    },
    startAt: { type: Date },
    endAt: { type: Date },
  },
  { timestamps: true },
);

export const Experiment = mongoose.model<IExperiment>('Experiment', experimentSchema);
