import mongoose, { type Document, Schema } from 'mongoose';
import { UserRole } from '@ghaarfix/shared-types';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLOCKED';

export interface IUser extends Document {
  role: UserRole;
  phone?: string;
  email?: string;
  passwordHash?: string;
  fullName?: string;
  profileImage?: string;
  isPhoneVerified: boolean;
  isProfileComplete: boolean;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, select: false },
    fullName: { type: String, trim: true },
    profileImage: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    isProfileComplete: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
