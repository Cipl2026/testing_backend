import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderCapacityStatus } from '@ghaarfix/shared-types';

export interface IProviderCapacity extends Document {
  providerId: Types.ObjectId;
  date: string;
  bookedCount: number;
  maxDailyJobs: number;
  status: ProviderCapacityStatus;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const providerCapacitySchema = new Schema<IProviderCapacity>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    bookedCount: { type: Number, default: 0, min: 0 },
    maxDailyJobs: { type: Number, default: 8, min: 1 },
    status: {
      type: String,
      enum: Object.values(ProviderCapacityStatus),
      default: ProviderCapacityStatus.AVAILABLE,
      index: true,
    },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

providerCapacitySchema.index({ providerId: 1, date: 1 }, { unique: true });

export const ProviderCapacity = mongoose.model<IProviderCapacity>(
  'ProviderCapacity',
  providerCapacitySchema,
);
