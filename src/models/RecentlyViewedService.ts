import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IRecentlyViewedService extends Document {
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  viewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recentlyViewedSchema = new Schema<IRecentlyViewedService>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

recentlyViewedSchema.index({ customerId: 1, serviceId: 1 }, { unique: true });

export const RecentlyViewedService = mongoose.model<IRecentlyViewedService>(
  'RecentlyViewedService',
  recentlyViewedSchema,
);
