import mongoose, { Schema, type Document } from 'mongoose';

export enum HomeCarouselPlacement {
  BANNER = 'BANNER',
  URGENT_FIX = 'URGENT_FIX',
  PICKED_FOR_YOU = 'PICKED_FOR_YOU',
  RECOMMENDED_FOR_YOU = 'RECOMMENDED_FOR_YOU',
}

export enum HomeCarouselActionType {
  NONE = 'NONE',
  SERVICE = 'SERVICE',
  CATEGORY = 'CATEGORY',
  ROUTE = 'ROUTE',
  URL = 'URL',
}

export interface IHomeCarouselItem extends Document {
  placement: HomeCarouselPlacement;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType: HomeCarouselActionType;
  actionValue?: string;
  displayOrder: number;
  isActive: boolean;
  validFrom?: Date;
  validTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const homeCarouselItemSchema = new Schema<IHomeCarouselItem>(
  {
    placement: {
      type: String,
      enum: Object.values(HomeCarouselPlacement),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    imageUrl: { type: String, required: true, trim: true },
    actionType: {
      type: String,
      enum: Object.values(HomeCarouselActionType),
      default: HomeCarouselActionType.NONE,
    },
    actionValue: { type: String, trim: true, maxlength: 500 },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    validFrom: Date,
    validTo: Date,
  },
  { timestamps: true },
);

homeCarouselItemSchema.index({ placement: 1, isActive: 1, displayOrder: 1 });

export const HomeCarouselItem =
  (mongoose.models.HomeCarouselItem as mongoose.Model<IHomeCarouselItem>) ||
  mongoose.model<IHomeCarouselItem>('HomeCarouselItem', homeCarouselItemSchema);
