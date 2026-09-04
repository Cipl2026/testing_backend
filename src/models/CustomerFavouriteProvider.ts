import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface ICustomerFavouriteProvider extends Document {
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  createdAt: Date;
}

const favouriteSchema = new Schema<ICustomerFavouriteProvider>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

favouriteSchema.index({ customerId: 1, providerId: 1 }, { unique: true });

export const CustomerFavouriteProvider = mongoose.model<ICustomerFavouriteProvider>(
  'CustomerFavouriteProvider',
  favouriteSchema,
);
