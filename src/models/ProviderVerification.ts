import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ProviderVerificationStatus,
  ProviderVerificationType,
} from '@ghaarfix/shared-types';

export interface IProviderVerification extends Document {
  providerId: Types.ObjectId;
  type: ProviderVerificationType;
  status: ProviderVerificationStatus;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  expiresAt?: Date;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const verificationSchema = new Schema<IProviderVerification>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(ProviderVerificationType), required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ProviderVerificationStatus),
      default: ProviderVerificationStatus.NOT_STARTED,
      index: true,
    },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, index: true },
    rejectionReason: { type: String, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

verificationSchema.index({ providerId: 1, type: 1 }, { unique: true });

export const ProviderVerification = mongoose.model<IProviderVerification>(
  'ProviderVerification',
  verificationSchema,
);
