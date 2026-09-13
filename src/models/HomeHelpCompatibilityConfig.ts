import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IHomeHelpCompatibilityConfig extends Document {
  key: 'global';
  maxTasksPerVisit: number;
  specialistExclusive: boolean;
  requireHomeHelpForMixedGroups: boolean;
  stackingRules: string[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const homeHelpCompatibilityConfigSchema = new Schema<IHomeHelpCompatibilityConfig>(
  {
    key: { type: String, enum: ['global'], required: true, unique: true, default: 'global' },
    maxTasksPerVisit: { type: Number, required: true, default: 8, min: 1, max: 20 },
    specialistExclusive: { type: Boolean, required: true, default: true },
    requireHomeHelpForMixedGroups: { type: Boolean, required: true, default: true },
    stackingRules: { type: [String], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const HomeHelpCompatibilityConfig = mongoose.model<IHomeHelpCompatibilityConfig>(
  'HomeHelpCompatibilityConfig',
  homeHelpCompatibilityConfigSchema,
);
