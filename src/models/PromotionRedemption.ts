import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IPromotionRedemption extends Document {
  promotionId: Types.ObjectId;
  customerId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  discountAmount: number;
  createdAt: Date;
}

const promotionRedemptionSchema = new Schema<IPromotionRedemption>(
  {
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    discountAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

promotionRedemptionSchema.index({ promotionId: 1, customerId: 1 });

export const PromotionRedemption = mongoose.model<IPromotionRedemption>(
  'PromotionRedemption',
  promotionRedemptionSchema,
);
