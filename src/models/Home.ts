import mongoose, { type Document, Schema, Types } from 'mongoose';
import { HomeType } from '@ghaarfix/shared-types';

export interface IHome extends Document {
  customerId: Types.ObjectId;
  addressId: Types.ObjectId;
  name: string;
  homeType: HomeType;
  isPrimary: boolean;
  isArchived: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const homeSchema = new Schema<IHome>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    homeType: { type: String, enum: Object.values(HomeType), default: HomeType.APARTMENT },
    isPrimary: { type: Boolean, default: false, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

homeSchema.index({ customerId: 1, isArchived: 1 });

export const Home = mongoose.model<IHome>('Home', homeSchema);
