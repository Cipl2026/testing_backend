import mongoose, { type Document, Schema } from 'mongoose';

export interface FeatureFlagRule {
  type: 'global' | 'percentage' | 'whitelist' | 'region';
  percentage?: number;
  customerIds?: string[];
  regions?: string[];
}

export interface IFeatureFlag extends Document {
  key: string;
  description?: string;
  enabled: boolean;
  rules: FeatureFlagRule[];
  createdAt: Date;
  updatedAt: Date;
}

const featureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    enabled: { type: Boolean, default: false, index: true },
    rules: {
      type: [
        {
          type: { type: String, enum: ['global', 'percentage', 'whitelist', 'region'] },
          percentage: Number,
          customerIds: [String],
          regions: [String],
        },
      ],
      default: [{ type: 'global' }],
    },
  },
  { timestamps: true },
);

export const FeatureFlag = mongoose.model<IFeatureFlag>('FeatureFlag', featureFlagSchema);
