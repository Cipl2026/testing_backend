import mongoose, { type Document, Schema, Types } from 'mongoose';
import { PerformancePeriod, ProviderQualityStatus } from '@ghaarfix/shared-types';

export interface IProviderPerformanceMetric extends Document {
  providerId: Types.ObjectId;
  period: PerformancePeriod;
  periodStart: Date;
  periodEnd?: Date;
  completedJobs: number;
  cancelledByProvider: number;
  lateArrivals: number;
  onTimeArrivals: number;
  averageRating: number;
  reviewCount: number;
  repeatedCustomers: number;
  customerComplaints: number;
  completionRate: number;
  acceptanceRate: number;
  qualityStatus: ProviderQualityStatus;
  alerts: string[];
  lastCalculatedAt: Date;
}

const metricSchema = new Schema<IProviderPerformanceMetric>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    period: { type: String, enum: Object.values(PerformancePeriod), required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date },
    completedJobs: { type: Number, default: 0 },
    cancelledByProvider: { type: Number, default: 0 },
    lateArrivals: { type: Number, default: 0 },
    onTimeArrivals: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    repeatedCustomers: { type: Number, default: 0 },
    customerComplaints: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 },
    qualityStatus: {
      type: String,
      enum: Object.values(ProviderQualityStatus),
      default: ProviderQualityStatus.GOOD,
    },
    alerts: { type: [String], default: [] },
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

metricSchema.index({ providerId: 1, period: 1, periodStart: 1 }, { unique: true });

export const ProviderPerformanceMetric = mongoose.model<IProviderPerformanceMetric>(
  'ProviderPerformanceMetric',
  metricSchema,
);
