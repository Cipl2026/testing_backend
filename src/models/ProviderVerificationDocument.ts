import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderVerificationDocumentStatus } from '@ghaarfix/shared-types';

export interface IProviderVerificationDocument extends Document {
  providerId: Types.ObjectId;
  verificationId: Types.ObjectId;
  documentType: string;
  fileUrl: string;
  fileKey: string;
  status: ProviderVerificationDocumentStatus;
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
}

const docSchema = new Schema<IProviderVerificationDocument>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    verificationId: { type: Schema.Types.ObjectId, ref: 'ProviderVerification', required: true, index: true },
    documentType: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ProviderVerificationDocumentStatus),
      default: ProviderVerificationDocumentStatus.PENDING,
    },
    uploadedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 500 },
  },
  { timestamps: false },
);

export const ProviderVerificationDocument = mongoose.model<IProviderVerificationDocument>(
  'ProviderVerificationDocument',
  docSchema,
);
