import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  ApiClientStatus,
  PartnerAgreementType,
  PartnerStatus,
  RegionLaunchStatus,
  RegionType,
  RegionServiceAreaType,
  RegionalCatalogStatus,
  TaxInclusionMode,
} from '@ghaarfix/shared-types';

export interface IRegion extends Document {
  name: string;
  code: string;
  type: RegionType;
  parentId?: Types.ObjectId;
  countryCode?: string;
  timezone: string;
  currencyCode: string;
  locale: string;
  isActive: boolean;
  launchStatus: RegionLaunchStatus;
  serviceAvailability: boolean;
  cityId?: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const regionSchema = new Schema<IRegion>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(RegionType), required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Region', index: true },
    countryCode: { type: String, uppercase: true, trim: true, index: true },
    timezone: { type: String, required: true },
    currencyCode: { type: String, required: true, uppercase: true },
    locale: { type: String, required: true },
    isActive: { type: Boolean, default: false, index: true },
    launchStatus: {
      type: String,
      enum: Object.values(RegionLaunchStatus),
      default: RegionLaunchStatus.DRAFT,
    },
    serviceAvailability: { type: Boolean, default: false },
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

regionSchema.index({ parentId: 1, type: 1 });

export const Region = mongoose.model<IRegion>('Region', regionSchema);

export interface IRegionalConfiguration extends Document {
  regionId: Types.ObjectId;
  version: number;
  effectiveAt: Date;
  currency: string;
  timezone: string;
  defaultLocale: string;
  supportedLocales: string[];
  phonePolicy?: Record<string, unknown>;
  addressFormat?: Record<string, unknown>;
  paymentMethods: string[];
  taxPolicyId?: Types.ObjectId;
  providerPolicyId?: Types.ObjectId;
  bookingPolicy?: Record<string, unknown>;
  emergencyPolicy?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
}

const regionalConfigSchema = new Schema<IRegionalConfiguration>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    effectiveAt: { type: Date, default: Date.now },
    currency: { type: String, required: true },
    timezone: { type: String, required: true },
    defaultLocale: { type: String, required: true },
    supportedLocales: { type: [String], default: [] },
    phonePolicy: Schema.Types.Mixed,
    addressFormat: Schema.Types.Mixed,
    paymentMethods: { type: [String], default: [] },
    taxPolicyId: { type: Schema.Types.ObjectId, ref: 'TaxPolicy' },
    providerPolicyId: { type: Schema.Types.ObjectId, ref: 'ProviderOnboardingPolicy' },
    bookingPolicy: Schema.Types.Mixed,
    emergencyPolicy: Schema.Types.Mixed,
    featureFlags: Schema.Types.Mixed,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

regionalConfigSchema.index({ regionId: 1, version: -1 }, { unique: true });

export const RegionalConfiguration = mongoose.model<IRegionalConfiguration>(
  'RegionalConfiguration',
  regionalConfigSchema,
);

export interface IServiceArea extends Document {
  regionId: Types.ObjectId;
  name: string;
  type: RegionServiceAreaType;
  isActive: boolean;
  priority: number;
  postalCodes?: string[];
  center?: { latitude: number; longitude: number };
  radiusMeters?: number;
  boundary?: { type: string; coordinates: number[][][] };
  serviceZoneId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const serviceAreaSchema = new Schema<IServiceArea>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(RegionServiceAreaType), required: true },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    postalCodes: [String],
    center: { latitude: Number, longitude: Number },
    radiusMeters: Number,
    boundary: Schema.Types.Mixed,
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

serviceAreaSchema.index({ 'center.latitude': 1, 'center.longitude': 1 });

export const ServiceArea = mongoose.model<IServiceArea>('ServiceArea', serviceAreaSchema);

export interface IRegionLaunchChecklist extends Document {
  regionId: Types.ObjectId;
  items: Array<{
    key: string;
    label: string;
    status: string;
    message?: string;
    checkedAt?: Date;
  }>;
  isReady: boolean;
  updatedAt: Date;
}

const checklistSchema = new Schema<IRegionLaunchChecklist>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, unique: true },
    items: [
      {
        key: String,
        label: String,
        status: String,
        message: String,
        checkedAt: Date,
      },
    ],
    isReady: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const RegionLaunchChecklist = mongoose.model<IRegionLaunchChecklist>(
  'RegionLaunchChecklist',
  checklistSchema,
);

export interface ITaxPolicy extends Document {
  regionId: Types.ObjectId;
  name: string;
  ratePercent: number;
  inclusionMode: TaxInclusionMode;
  serviceTypes?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
  invoiceRules?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

const taxPolicySchema = new Schema<ITaxPolicy>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    name: { type: String, required: true },
    ratePercent: { type: Number, required: true, default: 0 },
    inclusionMode: {
      type: String,
      enum: Object.values(TaxInclusionMode),
      default: TaxInclusionMode.EXCLUSIVE,
    },
    serviceTypes: [String],
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: Date,
    invoiceRules: Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const TaxPolicy = mongoose.model<ITaxPolicy>('TaxPolicy', taxPolicySchema);

export interface IRegionalPaymentPolicy extends Document {
  regionId: Types.ObjectId;
  methods: Array<{
    methodType: string;
    enabled: boolean;
    minAmount?: number;
    maxAmount?: number;
    gateway?: string;
  }>;
  defaultGateway?: string;
  isActive: boolean;
  createdAt: Date;
}

const paymentPolicySchema = new Schema<IRegionalPaymentPolicy>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, unique: true },
    methods: [
      {
        methodType: String,
        enabled: Boolean,
        minAmount: Number,
        maxAmount: Number,
        gateway: String,
      },
    ],
    defaultGateway: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RegionalPaymentPolicy = mongoose.model<IRegionalPaymentPolicy>(
  'RegionalPaymentPolicy',
  paymentPolicySchema,
);

export interface IRegionalPricingPolicy extends Document {
  regionId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  modifierType: 'FIXED' | 'PERCENTAGE';
  modifierValue: number;
  urgentSurchargePercent?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
}

const pricingPolicySchema = new Schema<IRegionalPricingPolicy>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    modifierType: { type: String, enum: ['FIXED', 'PERCENTAGE'], default: 'PERCENTAGE' },
    modifierValue: { type: Number, default: 0 },
    urgentSurchargePercent: Number,
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

pricingPolicySchema.index({ regionId: 1, serviceId: 1 });

export const RegionalPricingPolicy = mongoose.model<IRegionalPricingPolicy>(
  'RegionalPricingPolicy',
  pricingPolicySchema,
);

export interface IProviderOnboardingPolicy extends Document {
  regionId: Types.ObjectId;
  requiredDocuments: Array<{
    type: string;
    required: boolean;
    conditionalOn?: string;
    expiryDays?: number;
    verificationMethod?: string;
  }>;
  payoutRequirements?: Record<string, unknown>;
  trainingRequired: boolean;
  isActive: boolean;
  createdAt: Date;
}

const onboardingPolicySchema = new Schema<IProviderOnboardingPolicy>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, unique: true },
    requiredDocuments: [
      {
        type: String,
        required: Boolean,
        conditionalOn: String,
        expiryDays: Number,
        verificationMethod: String,
      },
    ],
    payoutRequirements: Schema.Types.Mixed,
    trainingRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ProviderOnboardingPolicy = mongoose.model<IProviderOnboardingPolicy>(
  'ProviderOnboardingPolicy',
  onboardingPolicySchema,
);

export interface IRegionalServiceCatalog extends Document {
  regionId: Types.ObjectId;
  serviceId: Types.ObjectId;
  status: RegionalCatalogStatus;
  localizedContent?: Record<string, { name?: string; description?: string }>;
  pricingPolicyId?: Types.ObjectId;
  eligibilityRules?: Record<string, unknown>;
  effectiveAt: Date;
  createdAt: Date;
}

const catalogSchema = new Schema<IRegionalServiceCatalog>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(RegionalCatalogStatus),
      default: RegionalCatalogStatus.AVAILABLE,
    },
    localizedContent: Schema.Types.Mixed,
    pricingPolicyId: { type: Schema.Types.ObjectId, ref: 'RegionalPricingPolicy' },
    eligibilityRules: Schema.Types.Mixed,
    effectiveAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

catalogSchema.index({ regionId: 1, serviceId: 1 }, { unique: true });

export const RegionalServiceCatalog = mongoose.model<IRegionalServiceCatalog>(
  'RegionalServiceCatalog',
  catalogSchema,
);

export interface IPartner extends Document {
  name: string;
  code: string;
  status: PartnerStatus;
  contactEmail?: string;
  contactPhone?: string;
  organizationId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(PartnerStatus),
      default: PartnerStatus.APPLIED,
      index: true,
    },
    contactEmail: String,
    contactPhone: String,
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const Partner = mongoose.model<IPartner>('Partner', partnerSchema);

export interface IPartnerRegionAssignment extends Document {
  partnerId: Types.ObjectId;
  regionId: Types.ObjectId;
  isActive: boolean;
  assignedAt: Date;
}

const partnerRegionSchema = new Schema<IPartnerRegionAssignment>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    isActive: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

partnerRegionSchema.index({ partnerId: 1, regionId: 1 }, { unique: true });

export const PartnerRegionAssignment = mongoose.model<IPartnerRegionAssignment>(
  'PartnerRegionAssignment',
  partnerRegionSchema,
);

export interface IPartnerAgreement extends Document {
  partnerId: Types.ObjectId;
  regionId?: Types.ObjectId;
  type: PartnerAgreementType;
  commissionPercent?: number;
  revenueSharePercent?: number;
  fixedFeeMinor?: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
}

const agreementSchema = new Schema<IPartnerAgreement>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region' },
    type: { type: String, enum: Object.values(PartnerAgreementType), required: true },
    commissionPercent: Number,
    revenueSharePercent: Number,
    fixedFeeMinor: Number,
    currency: { type: String, required: true },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PartnerAgreement = mongoose.model<IPartnerAgreement>(
  'PartnerAgreement',
  agreementSchema,
);

export interface IPartnerPerformanceSnapshot extends Document {
  partnerId: Types.ObjectId;
  regionId?: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  bookingCount: number;
  completionRate: number;
  cancellationRate: number;
  revenueMinor: number;
  currency: string;
  avgRating?: number;
  createdAt: Date;
}

const partnerPerfSchema = new Schema<IPartnerPerformanceSnapshot>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region' },
    periodStart: Date,
    periodEnd: Date,
    bookingCount: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    revenueMinor: { type: Number, default: 0 },
    currency: String,
    avgRating: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

partnerPerfSchema.index({ partnerId: 1, periodStart: -1 });

export const PartnerPerformanceSnapshot = mongoose.model<IPartnerPerformanceSnapshot>(
  'PartnerPerformanceSnapshot',
  partnerPerfSchema,
);

export interface IDataResidencyPolicy extends Document {
  regionId: Types.ObjectId;
  dataCategories: string[];
  storageRegion: string;
  replicationAllowed: boolean;
  backupRegion?: string;
  retentionPolicy?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

const residencySchema = new Schema<IDataResidencyPolicy>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, unique: true },
    dataCategories: [String],
    storageRegion: { type: String, required: true },
    replicationAllowed: { type: Boolean, default: false },
    backupRegion: String,
    retentionPolicy: Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DataResidencyPolicy = mongoose.model<IDataResidencyPolicy>(
  'DataResidencyPolicy',
  residencySchema,
);

export interface IRegionPerformanceSnapshot extends Document {
  regionId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  bookings: number;
  revenueMinor: number;
  currency: string;
  completionRate: number;
  cancellationRate: number;
  urgentRequests: number;
  providerAcceptanceRate: number;
  avgRating?: number;
  indicators: Record<string, number>;
  createdAt: Date;
}

const regionPerfSchema = new Schema<IRegionPerformanceSnapshot>(
  {
    regionId: { type: Schema.Types.ObjectId, ref: 'Region', required: true, index: true },
    periodStart: Date,
    periodEnd: Date,
    bookings: { type: Number, default: 0 },
    revenueMinor: { type: Number, default: 0 },
    currency: String,
    completionRate: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    urgentRequests: { type: Number, default: 0 },
    providerAcceptanceRate: { type: Number, default: 0 },
    avgRating: Number,
    indicators: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

regionPerfSchema.index({ regionId: 1, periodStart: -1 });

export const RegionPerformanceSnapshot = mongoose.model<IRegionPerformanceSnapshot>(
  'RegionPerformanceSnapshot',
  regionPerfSchema,
);

export interface ITranslation extends Document {
  key: string;
  locale: string;
  value: string;
  regionId?: Types.ObjectId;
  updatedAt: Date;
}

const translationSchema = new Schema<ITranslation>(
  {
    key: { type: String, required: true, index: true },
    locale: { type: String, required: true, index: true },
    value: { type: String, required: true },
    regionId: { type: Schema.Types.ObjectId, ref: 'Region' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

translationSchema.index({ key: 1, locale: 1, regionId: 1 }, { unique: true });

export const Translation = mongoose.model<ITranslation>('Translation', translationSchema);

export interface IApiClient extends Document {
  name: string;
  organizationId?: Types.ObjectId;
  partnerId?: Types.ObjectId;
  scopes: string[];
  status: ApiClientStatus;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const apiClientSchema = new Schema<IApiClient>(
  {
    name: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },
    scopes: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(ApiClientStatus),
      default: ApiClientStatus.ACTIVE,
      index: true,
    },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    lastUsedAt: Date,
  },
  { timestamps: true },
);

export const ApiClient = mongoose.model<IApiClient>('ApiClient', apiClientSchema);
