import mongoose, { type Document, Schema, Types } from 'mongoose';
import { AddressLabel } from '@ghaarfix/shared-types';

export interface ICustomerAddress extends Document {
  customerId: Types.ObjectId;
  label: AddressLabel;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerAddressSchema = new Schema<ICustomerAddress>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, enum: Object.values(AddressLabel), required: true },
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true, index: true },
    country: { type: String, required: true, trim: true, default: 'India' },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    isDefault: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

customerAddressSchema.index({ location: '2dsphere' });
customerAddressSchema.index({ customerId: 1, isDefault: 1 });

export const CustomerAddress = mongoose.model<ICustomerAddress>(
  'CustomerAddress',
  customerAddressSchema,
);
