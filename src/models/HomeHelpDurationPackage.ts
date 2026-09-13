import mongoose, { type Document, Schema } from 'mongoose';

export interface IHomeHelpDurationPackage extends Document {
  label: string;
  durationMinutes: number;
  basePrice: number;
  currency: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const homeHelpDurationPackageSchema = new Schema<IHomeHelpDurationPackage>(
  {
    label: { type: String, required: true, trim: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

export const HomeHelpDurationPackage = mongoose.model<IHomeHelpDurationPackage>(
  'HomeHelpDurationPackage',
  homeHelpDurationPackageSchema,
);
