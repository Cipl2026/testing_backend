import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  CapacityPlanScope,
  CityLaunchReadinessStatus,
  CoverageGapSeverity,
  CoverageGapStatus,
  CoverageOpportunityStatus,
  ExpansionRecommendationStatus,
  ExpansionTargetType,
  ProviderShiftStatus,
  RecruitmentSignalStatus,
  ShiftRecommendationStatus,
  SupplyAlertSeverity,
  SupplyAlertStatus,
  SupplyDemandStatus,
} from '@ghaarfix/shared-types';

export interface IZoneCapacitySnapshot extends Document {
  zoneId: Types.ObjectId;
  serviceId: Types.ObjectId;
  timeBucket: Date;
  availableProviders: number;
  activeProviders: number;
  scheduledCapacity: number;
  bookedCapacity: number;
  estimatedDemand: number;
  supplyDemandRatio: number;
  supplyStatus: SupplyDemandStatus;
  createdAt: Date;
}

const snapshotSchema = new Schema<IZoneCapacitySnapshot>(
  {
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    timeBucket: { type: Date, required: true, index: true },
    availableProviders: { type: Number, default: 0 },
    activeProviders: { type: Number, default: 0 },
    scheduledCapacity: { type: Number, default: 0 },
    bookedCapacity: { type: Number, default: 0 },
    estimatedDemand: { type: Number, default: 0 },
    supplyDemandRatio: { type: Number, default: 1 },
    supplyStatus: { type: String, enum: Object.values(SupplyDemandStatus), required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
snapshotSchema.index({ zoneId: 1, serviceId: 1, timeBucket: 1 }, { unique: true });

export const ZoneCapacitySnapshot = mongoose.model<IZoneCapacitySnapshot>(
  'ZoneCapacitySnapshot',
  snapshotSchema,
);

export interface ICoverageGap extends Document {
  cityId?: Types.ObjectId;
  serviceZoneId: Types.ObjectId;
  serviceId: Types.ObjectId;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  severity: CoverageGapSeverity;
  demandEstimate: number;
  supplyEstimate: number;
  recommendation: string;
  status: CoverageGapStatus;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const gapSchema = new Schema<ICoverageGap>(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City', index: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    timeRangeStart: { type: Date, required: true },
    timeRangeEnd: { type: Date, required: true },
    severity: { type: String, enum: Object.values(CoverageGapSeverity), required: true },
    demandEstimate: { type: Number, default: 0 },
    supplyEstimate: { type: Number, default: 0 },
    recommendation: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(CoverageGapStatus),
      default: CoverageGapStatus.OPEN,
      index: true,
    },
    dedupeKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);
gapSchema.index({ serviceZoneId: 1, serviceId: 1, status: 1 });

export const CoverageGap = mongoose.model<ICoverageGap>('CoverageGap', gapSchema);

export interface IProviderRecruitmentSignal extends Document {
  cityId?: Types.ObjectId;
  zoneId: Types.ObjectId;
  serviceId: Types.ObjectId;
  priorityScore: number;
  reason: string;
  recommendedProviderCount: number;
  status: RecruitmentSignalStatus;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const recruitmentSchema = new Schema<IProviderRecruitmentSignal>(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    priorityScore: { type: Number, default: 0, index: true },
    reason: { type: String, required: true },
    recommendedProviderCount: { type: Number, default: 1 },
    status: {
      type: String,
      enum: Object.values(RecruitmentSignalStatus),
      default: RecruitmentSignalStatus.OPEN,
    },
    dedupeKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const ProviderRecruitmentSignal = mongoose.model<IProviderRecruitmentSignal>(
  'ProviderRecruitmentSignal',
  recruitmentSchema,
);

export interface IProviderShift extends Document {
  providerId: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  preferredZones: Types.ObjectId[];
  status: ProviderShiftStatus;
  capacityLimit: number;
  confirmedByProvider: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema = new Schema<IProviderShift>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    preferredZones: [{ type: Schema.Types.ObjectId, ref: 'ServiceZone' }],
    status: {
      type: String,
      enum: Object.values(ProviderShiftStatus),
      default: ProviderShiftStatus.PLANNED,
    },
    capacityLimit: { type: Number, default: 8 },
    confirmedByProvider: { type: Boolean, default: false },
  },
  { timestamps: true },
);
shiftSchema.index({ providerId: 1, date: 1, startTime: 1 });

export const ProviderShift = mongoose.model<IProviderShift>('ProviderShift', shiftSchema);

export interface IShiftRecommendation extends Document {
  providerId: Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  zoneId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  reason: string;
  expectedOpportunityScore: number;
  status: ShiftRecommendationStatus;
  expiresAt: Date;
  createdAt: Date;
}

const shiftRecSchema = new Schema<IShiftRecommendation>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    reason: { type: String, required: true },
    expectedOpportunityScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ShiftRecommendationStatus),
      default: ShiftRecommendationStatus.PENDING,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ShiftRecommendation = mongoose.model<IShiftRecommendation>(
  'ShiftRecommendation',
  shiftRecSchema,
);

export interface ICoverageOpportunity extends Document {
  providerId: Types.ObjectId;
  fromZoneId?: Types.ObjectId;
  toZoneId: Types.ObjectId;
  reason: string;
  estimatedDemand: number;
  estimatedTravelMinutes?: number;
  status: CoverageOpportunityStatus;
  expiresAt: Date;
  createdAt: Date;
}

const opportunitySchema = new Schema<ICoverageOpportunity>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    toZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true },
    reason: { type: String, required: true },
    estimatedDemand: { type: Number, default: 0 },
    estimatedTravelMinutes: Number,
    status: {
      type: String,
      enum: Object.values(CoverageOpportunityStatus),
      default: CoverageOpportunityStatus.PENDING,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CoverageOpportunity = mongoose.model<ICoverageOpportunity>(
  'CoverageOpportunity',
  opportunitySchema,
);

export interface ISupplyAlert extends Document {
  scope: string;
  zoneId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  severity: SupplyAlertSeverity;
  title: string;
  details: string;
  recommendedAction: string;
  status: SupplyAlertStatus;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<ISupplyAlert>(
  {
    scope: { type: String, required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    severity: { type: String, enum: Object.values(SupplyAlertSeverity), required: true, index: true },
    title: { type: String, required: true },
    details: { type: String, required: true },
    recommendedAction: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SupplyAlertStatus),
      default: SupplyAlertStatus.OPEN,
      index: true,
    },
    dedupeKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);
alertSchema.index({ severity: 1, createdAt: -1 });

export const SupplyAlert = mongoose.model<ISupplyAlert>('SupplyAlert', alertSchema);

export interface ICityLaunchReadiness extends Document {
  cityId: Types.ObjectId;
  serviceId: Types.ObjectId;
  providerSupplyScore: number;
  expectedDemandScore: number;
  qualityReadiness: number;
  paymentReadiness: number;
  supportReadiness: number;
  overallStatus: CityLaunchReadinessStatus;
  checklist: Array<{ item: string; passed: boolean }>;
  updatedAt: Date;
}

const readinessSchema = new Schema<ICityLaunchReadiness>(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    providerSupplyScore: { type: Number, default: 0 },
    expectedDemandScore: { type: Number, default: 0 },
    qualityReadiness: { type: Number, default: 0 },
    paymentReadiness: { type: Number, default: 0 },
    supportReadiness: { type: Number, default: 0 },
    overallStatus: {
      type: String,
      enum: Object.values(CityLaunchReadinessStatus),
      default: CityLaunchReadinessStatus.NOT_READY,
    },
    checklist: [{ item: String, passed: Boolean }],
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
readinessSchema.index({ cityId: 1, serviceId: 1 }, { unique: true });

export const CityLaunchReadiness = mongoose.model<ICityLaunchReadiness>(
  'CityLaunchReadiness',
  readinessSchema,
);

export interface IExpansionRecommendation extends Document {
  targetType: ExpansionTargetType;
  targetId: Types.ObjectId;
  score: number;
  reasons: string[];
  confidence: number;
  status: ExpansionRecommendationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const expansionSchema = new Schema<IExpansionRecommendation>(
  {
    targetType: { type: String, enum: Object.values(ExpansionTargetType), required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    score: { type: Number, default: 0 },
    reasons: [String],
    confidence: { type: Number, default: 0.5 },
    status: {
      type: String,
      enum: Object.values(ExpansionRecommendationStatus),
      default: ExpansionRecommendationStatus.PENDING,
      index: true,
    },
  },
  { timestamps: true },
);

export const ExpansionRecommendation = mongoose.model<IExpansionRecommendation>(
  'ExpansionRecommendation',
  expansionSchema,
);

export interface INetworkCapacityPlan extends Document {
  scope: CapacityPlanScope;
  scopeId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  expectedDemand: number;
  expectedSupply: number;
  gap: number;
  actions: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const planSchema = new Schema<INetworkCapacityPlan>(
  {
    scope: { type: String, enum: Object.values(CapacityPlanScope), required: true },
    scopeId: { type: Schema.Types.ObjectId, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    expectedDemand: { type: Number, default: 0 },
    expectedSupply: { type: Number, default: 0 },
    gap: { type: Number, default: 0 },
    actions: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const NetworkCapacityPlan = mongoose.model<INetworkCapacityPlan>(
  'NetworkCapacityPlan',
  planSchema,
);

export interface IZoneQualityMetric extends Document {
  zoneId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  sampleSize: number;
  averageRating: number;
  cancellationRate: number;
  noShowRate: number;
  slaBreachRate: number;
  qualityStatus: string;
  periodStart: Date;
  periodEnd: Date;
  updatedAt: Date;
}

const qualitySchema = new Schema<IZoneQualityMetric>(
  {
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    sampleSize: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    noShowRate: { type: Number, default: 0 },
    slaBreachRate: { type: Number, default: 0 },
    qualityStatus: { type: String, default: 'GOOD' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const ZoneQualityMetric = mongoose.model<IZoneQualityMetric>(
  'ZoneQualityMetric',
  qualitySchema,
);
