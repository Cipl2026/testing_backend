import mongoose, { type Document, Schema, Types } from 'mongoose';
import { PromotionStatus, PromotionType } from '@ghaarfix/shared-types';

export interface IPromotion extends Document {
  code: string;
  type: PromotionType;
  value: number;
  minimumOrder?: number;
  maximumDiscount?: number;
  serviceIds: Types.ObjectId[];
  categoryIds: Types.ObjectId[];
  regions: string[];
  usageLimit?: number;
  usageCount: number;
  perCustomerLimit?: number;
  validFrom: Date;
  validTo: Date;
  status: PromotionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const promotionSchema = new Schema<IPromotion>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(PromotionType), required: true },
    value: { type: Number, required: true, min: 0 },
    minimumOrder: { type: Number, min: 0 },
    maximumDiscount: { type: Number, min: 0 },
    serviceIds: { type: [Schema.Types.ObjectId], ref: 'Service', default: [] },
    categoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    regions: { type: [String], default: [] },
    usageLimit: { type: Number, min: 1 },
    usageCount: { type: Number, default: 0 },
    perCustomerLimit: { type: Number, min: 1 },
    validFrom: { type: Date, required: true, index: true },
    validTo: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(PromotionStatus),
      default: PromotionStatus.DRAFT,
      index: true,
    },
  },
  { timestamps: true },
);

export const Promotion = mongoose.model<IPromotion>('Promotion', promotionSchema);
