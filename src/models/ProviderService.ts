import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderServiceApprovalStatus } from '@ghaarfix/shared-types';

export interface IProviderService extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  experienceYears?: number;
  description?: string;
  customPricing: {
    enabled: boolean;
    visitCharge?: number;
    startingPrice?: number;
    notes?: string;
  };
  isActive: boolean;
  supportsUrgent: boolean;
  isUrgentEnabled: boolean;
  approvalStatus: ProviderServiceApprovalStatus;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerServiceSchema = new Schema<IProviderService>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    experienceYears: { type: Number, min: 0 },
    description: { type: String, maxlength: 1000 },
    customPricing: {
      enabled: { type: Boolean, default: false },
      visitCharge: { type: Number, min: 0 },
      startingPrice: { type: Number, min: 0 },
      notes: { type: String },
    },
    isActive: { type: Boolean, default: true },
    supportsUrgent: { type: Boolean, default: false, index: true },
    isUrgentEnabled: { type: Boolean, default: false, index: true },
    approvalStatus: {
      type: String,
      enum: Object.values(ProviderServiceApprovalStatus),
      default: ProviderServiceApprovalStatus.PENDING,
      index: true,
    },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

providerServiceSchema.index({ providerId: 1, serviceId: 1 }, { unique: true });
providerServiceSchema.index({ providerId: 1, approvalStatus: 1 });
providerServiceSchema.index({ serviceId: 1, approvalStatus: 1 });

export const ProviderService = mongoose.model<IProviderService>(
  'ProviderService',
  providerServiceSchema,
);
