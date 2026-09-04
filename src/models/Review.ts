import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ReviewCategory, ReviewStatus } from '@ghaarfix/shared-types';

export interface CategoryRating {
  category: ReviewCategory;
  rating: number;
}

export interface IReview extends Document {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  rating: number;
  comment?: string;
  categories: CategoryRating[];
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 2000 },
    categories: [
      {
        category: { type: String, enum: Object.values(ReviewCategory) },
        rating: { type: Number, min: 1, max: 5 },
      },
    ],
    status: {
      type: String,
      enum: Object.values(ReviewStatus),
      default: ReviewStatus.PUBLISHED,
      index: true,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ providerId: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
