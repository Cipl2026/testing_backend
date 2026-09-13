import mongoose, { type Document, Schema } from 'mongoose';

export interface IPlatformBranding extends Document {
  key: string;
  customerLogoUrl?: string;
  customerLogoDarkUrl?: string;
  providerLogoUrl?: string;
  providerLogoDarkUrl?: string;
  customerAppName: string;
  providerAppName: string;
  customerApiUrl?: string;
  providerApiUrl?: string;
  updatedAt: Date;
  createdAt: Date;
}

const platformBrandingSchema = new Schema<IPlatformBranding>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    customerLogoUrl: { type: String },
    customerLogoDarkUrl: { type: String },
    providerLogoUrl: { type: String },
    providerLogoDarkUrl: { type: String },
    customerAppName: { type: String, default: 'Ghaarfix' },
    providerAppName: { type: String, default: 'Ghaarfix Pro' },
    customerApiUrl: { type: String },
    providerApiUrl: { type: String },
  },
  { timestamps: true },
);

export const PlatformBranding = mongoose.model<IPlatformBranding>(
  'PlatformBranding',
  platformBrandingSchema,
);
