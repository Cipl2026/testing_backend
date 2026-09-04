import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IFavoriteService extends Document {
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteServiceSchema = new Schema<IFavoriteService>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
  },
  { timestamps: true },
);

favoriteServiceSchema.index({ customerId: 1, serviceId: 1 }, { unique: true });

export const FavoriteService = mongoose.model<IFavoriteService>(
  'FavoriteService',
  favoriteServiceSchema,
);
