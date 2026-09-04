import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface ICustomerProfile extends Document {
  userId: Types.ObjectId;
  fullName?: string;
  email?: string;
  profileImage?: string;
  dateOfBirth?: Date;
  defaultAddressId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    profileImage: { type: String },
    dateOfBirth: { type: Date },
    defaultAddressId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

export const CustomerProfile = mongoose.model<ICustomerProfile>(
  'CustomerProfile',
  customerProfileSchema,
);
