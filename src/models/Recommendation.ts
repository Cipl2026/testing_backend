import mongoose, { type Document, Schema, Types } from 'mongoose';
import { RecommendationSource, RecommendationType } from '@ghaarfix/shared-types';

export interface IRecommendation extends Document {
  customerId: Types.ObjectId;
  homeId?: Types.ObjectId;
  type: RecommendationType;
  title: string;
  description: string;
  action: {
    type: string;
    serviceId?: Types.ObjectId;
    bundleId?: Types.ObjectId;
    bookingId?: Types.ObjectId;
    assetId?: Types.ObjectId;
  };
  priority: number;
  reason: string;
  source: RecommendationSource;
  expiresAt: Date;
  dismissedAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema<IRecommendation>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', index: true },
    type: { type: String, enum: Object.values(RecommendationType), required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    action: {
      type: { type: String, required: true },
      serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
      bundleId: { type: Schema.Types.ObjectId, ref: 'ServiceBundle' },
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
      assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset' },
    },
    priority: { type: Number, default: 0 },
    reason: { type: String, required: true, trim: true },
    source: { type: String, enum: Object.values(RecommendationSource), required: true },
    expiresAt: { type: Date, required: true, index: true },
    dismissedAt: { type: Date },
    clickedAt: { type: Date },
  },
  { timestamps: true },
);

recommendationSchema.index({ customerId: 1, type: 1, expiresAt: 1 });

export const Recommendation = mongoose.model<IRecommendation>(
  'Recommendation',
  recommendationSchema,
);
