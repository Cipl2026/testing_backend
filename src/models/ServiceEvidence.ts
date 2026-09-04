import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ServiceEvidenceType } from '@ghaarfix/shared-types';

export interface IServiceEvidence extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  type: ServiceEvidenceType;
  fileUrl: string;
  fileKey: string;
  mimeType: string;
  fileSizeBytes: number;
  caption?: string;
  metadata?: Record<string, unknown>;
  capturedAt: Date;
  createdAt: Date;
}

const serviceEvidenceSchema = new Schema<IServiceEvidence>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(ServiceEvidenceType), required: true, index: true },
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    caption: { type: String, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
    capturedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

serviceEvidenceSchema.index({ bookingId: 1, type: 1, createdAt: -1 });

export const ServiceEvidence = mongoose.model<IServiceEvidence>(
  'ServiceEvidence',
  serviceEvidenceSchema,
);
