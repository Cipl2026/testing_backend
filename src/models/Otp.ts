import mongoose, { type Document, Schema } from 'mongoose';
import { UserRole } from '@ghaarfix/shared-types';

export interface IOtp extends Document {
  requestId: string;
  phone: string;
  role: UserRole.CUSTOMER | UserRole.PROVIDER;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  isVerified: boolean;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    requestId: { type: String, required: true, unique: true },
    phone: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.PROVIDER],
      required: true,
    },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, role: 1, isVerified: 1 });

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
