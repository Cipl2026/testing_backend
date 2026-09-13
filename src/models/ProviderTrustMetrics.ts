import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderBadge } from '@ghaarfix/shared-types';

export interface IProviderTrustMetrics extends Document {
  providerId: Types.ObjectId;
  completedJobs: number;
  cancelledJobs: number;
  averageRating: number;
  reviewCount: number;
  onTimePercentage: number;
  trustScore?: number;
  cancellationRate?: number;
  badges: ProviderBadge[];
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const providerTrustMetricsSchema = new Schema<IProviderTrustMetrics>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    completedJobs: { type: Number, default: 0 },
    cancelledJobs: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    onTimePercentage: { type: Number, default: 100 },
    trustScore: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    badges: { type: [String], enum: Object.values(ProviderBadge), default: [] },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const ProviderTrustMetrics = mongoose.model<IProviderTrustMetrics>(
  'ProviderTrustMetrics',
  providerTrustMetricsSchema,
);
