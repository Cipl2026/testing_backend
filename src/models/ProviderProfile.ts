import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderStatus } from '@ghaarfix/shared-types';

export type ProviderGender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface IProviderProfile extends Document {
  userId: Types.ObjectId;
  fullName?: string;
  email?: string;
  profileImage?: string;
  dateOfBirth?: Date;
  gender?: ProviderGender;
  experienceYears?: number;
  bio?: string;
  languages: string[];
  providerStatus: ProviderStatus;
  isProfileComplete: boolean;
  isVerified: boolean;
  serviceBase?: {
    latitude: number;
    longitude: number;
  };
  normalBookingRadiusKm?: number;
  urgentBookingRadiusKm?: number;
  acceptsUrgentJobs?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerProfileSchema = new Schema<IProviderProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    profileImage: { type: String },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
    },
    experienceYears: { type: Number, min: 0 },
    bio: { type: String, maxlength: 1000 },
    languages: { type: [String], default: [] },
    providerStatus: {
      type: String,
      enum: Object.values(ProviderStatus),
      default: ProviderStatus.PENDING,
    },
    isProfileComplete: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    serviceBase: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    normalBookingRadiusKm: { type: Number, min: 1, max: 200, default: 10 },
    urgentBookingRadiusKm: { type: Number, min: 1, max: 200, default: 5 },
    acceptsUrgentJobs: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProviderProfile = mongoose.model<IProviderProfile>(
  'ProviderProfile',
  providerProfileSchema,
);
