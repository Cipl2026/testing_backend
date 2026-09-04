import mongoose, { type Document, Schema, Types } from 'mongoose';
import { WarrantyStatus, WarrantyType } from '@ghaarfix/shared-types';

export interface IWarranty extends Document {
  assetId: Types.ObjectId;
  customerId: Types.ObjectId;
  provider: string;
  warrantyType: WarrantyType;
  startDate: Date;
  endDate: Date;
  coverage?: string;
  documentUrl?: string;
  documentKey?: string;
  notes?: string;
  status: WarrantyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const warrantySchema = new Schema<IWarranty>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true, trim: true },
    warrantyType: { type: String, enum: Object.values(WarrantyType), default: WarrantyType.MANUFACTURER },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    coverage: { type: String, maxlength: 1000 },
    documentUrl: { type: String },
    documentKey: { type: String },
    notes: { type: String, maxlength: 500 },
    status: { type: String, enum: Object.values(WarrantyStatus), default: WarrantyStatus.ACTIVE, index: true },
  },
  { timestamps: true },
);

export const Warranty = mongoose.model<IWarranty>('Warranty', warrantySchema);
