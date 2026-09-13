import mongoose, { type Document, Schema, Types } from 'mongoose';
import { PricingType, ServiceProviderType, HomeHelpCompatibilityGroup } from '@ghaarfix/shared-types';

export interface ServiceUrgentConfig {
  enabled: boolean;
  baseFee: number;
  extraFee: number;
  responseTimeoutMinutes: number;
  maxProviderDistanceKm: number;
  maxBroadcastProviders: number;
}

export interface IService extends Document {
  categoryId: Types.ObjectId;
  subcategoryId: Types.ObjectId;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  image?: string;
  pricing: {
    type: PricingType;
    startingPrice?: number;
    currency: string;
  };
  estimatedDuration: {
    minMinutes: number;
    maxMinutes: number;
  };
  whatIsIncluded: string[];
  whatIsNotIncluded: string[];
  faqs: { question: string; answer: string }[];
  warranty?: { days?: number; description?: string };
  isActive: boolean;
  isFeatured: boolean;
  isUrgentAvailable: boolean;
  urgentConfig: ServiceUrgentConfig;
  displayOrder: number;
  supportedAssetTypeIds: Types.ObjectId[];
  keywords: string[];
  aliases: string[];
  searchText: string;
  providerType: ServiceProviderType;
  hourlyEligible: boolean;
  instantEligible: boolean;
  compatibilityGroup?: HomeHelpCompatibilityGroup;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    image: { type: String },
    pricing: {
      type: {
        type: String,
        enum: Object.values(PricingType),
        required: true,
      },
      startingPrice: { type: Number, min: 0 },
      currency: { type: String, default: 'INR' },
    },
    estimatedDuration: {
      minMinutes: { type: Number, required: true, min: 1 },
      maxMinutes: { type: Number, required: true, min: 1 },
    },
    whatIsIncluded: { type: [String], default: [] },
    whatIsNotIncluded: { type: [String], default: [] },
    faqs: {
      type: [{ question: String, answer: String }],
      default: [],
    },
    warranty: {
      days: { type: Number, min: 0 },
      description: { type: String },
    },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isUrgentAvailable: { type: Boolean, default: false, index: true },
    urgentConfig: {
      enabled: { type: Boolean, default: false },
      baseFee: { type: Number, default: 0, min: 0 },
      extraFee: { type: Number, default: 0, min: 0 },
      responseTimeoutMinutes: { type: Number, default: 10, min: 1 },
      maxProviderDistanceKm: { type: Number, default: 10, min: 1 },
      maxBroadcastProviders: { type: Number, default: 10, min: 1 },
    },
    displayOrder: { type: Number, default: 0, index: true },
    supportedAssetTypeIds: { type: [Schema.Types.ObjectId], ref: 'AssetType', default: [] },
    keywords: { type: [String], default: [] },
    aliases: { type: [String], default: [] },
    searchText: { type: String, default: '', index: 'text' },
    providerType: {
      type: String,
      enum: Object.values(ServiceProviderType),
      default: ServiceProviderType.SERVICE_PROFESSIONAL,
      index: true,
    },
    hourlyEligible: { type: Boolean, default: false, index: true },
    instantEligible: { type: Boolean, default: false },
    compatibilityGroup: {
      type: String,
      enum: Object.values(HomeHelpCompatibilityGroup),
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

function buildServiceSearchText(doc: IService): string {
  const parts = [
    doc.name,
    doc.shortDescription,
    doc.description,
    ...(doc.keywords ?? []),
    ...(doc.aliases ?? []),
  ].filter(Boolean);
  return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

serviceSchema.pre('save', function buildSearchText(next) {
  this.searchText = buildServiceSearchText(this);
  next();
});

export const Service = mongoose.model<IService>('Service', serviceSchema);
