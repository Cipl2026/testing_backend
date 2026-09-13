import mongoose, { type Document, Schema } from 'mongoose';

export type MobileAppTarget = 'customer' | 'provider';
export type MobilePlatform = 'ios' | 'android';

export interface IAppVersion extends Document {
  app: MobileAppTarget;
  platform: MobilePlatform;
  latestVersion: string;
  minimumSupportedVersion: string;
  latestBuildNumber?: number;
  minimumBuildNumber?: number;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const appVersionSchema = new Schema<IAppVersion>(
  {
    app: { type: String, enum: ['customer', 'provider'], required: true, index: true },
    platform: { type: String, enum: ['ios', 'android'], required: true, index: true },
    latestVersion: { type: String, required: true },
    minimumSupportedVersion: { type: String, required: true },
    latestBuildNumber: Number,
    minimumBuildNumber: Number,
    forceUpdate: { type: Boolean, default: false },
    storeUrl: { type: String, required: true },
    releaseNotes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

appVersionSchema.index({ app: 1, platform: 1 }, { unique: true });

export const AppVersion = mongoose.model<IAppVersion>('AppVersion', appVersionSchema);
