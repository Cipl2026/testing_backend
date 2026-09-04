import mongoose, { type Document, Schema } from 'mongoose';
import { UserRole } from '@ghaarfix/shared-types';

export interface IRegistrationIntent extends Document {
  requestId: string;
  phone: string;
  role: UserRole.CUSTOMER | UserRole.PROVIDER;
  fullName?: string;
  email?: string;
  referralCode?: string;
  mpinHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const registrationIntentSchema = new Schema<IRegistrationIntent>(
  {
    requestId: { type: String, required: true, unique: true },
    phone: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.PROVIDER],
      required: true,
    },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    referralCode: { type: String, trim: true, uppercase: true },
    mpinHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

registrationIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RegistrationIntent = mongoose.model<IRegistrationIntent>(
  'RegistrationIntent',
  registrationIntentSchema,
);
