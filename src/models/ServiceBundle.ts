import mongoose, { type Document, Schema, Types } from 'mongoose';
import { BundlePricingMode } from '@ghaarfix/shared-types';

export interface IServiceBundle extends Document {
  name: string;
  description?: string;
  serviceIds: Types.ObjectId[];
  pricingMode: BundlePricingMode;
  discount?: number;
  fixedPrice?: number;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceBundleSchema = new Schema<IServiceBundle>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    serviceIds: { type: [Schema.Types.ObjectId], ref: 'Service', required: true },
    pricingMode: { type: String, enum: Object.values(BundlePricingMode), required: true },
    discount: { type: Number, min: 0, max: 100 },
    fixedPrice: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    validFrom: { type: Date, required: true, index: true },
    validTo: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const ServiceBundle = mongoose.model<IServiceBundle>('ServiceBundle', serviceBundleSchema);
