import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ChurnRiskLevel,
  CustomerLifecycleState,
  LifecycleCampaignObjective,
  LifecycleCampaignStatus,
  LoyaltyEventType,
  LoyaltyTier,
  MarketingChannel,
  ReactivationTrigger,
  ReferralReviewStatus,
  ServiceRecommendationSource,
  ServiceRecommendationStatus,
} from '@ghaarfix/shared-types';
import { DEFAULT_LIFECYCLE_THRESHOLDS } from '@ghaarfix/shared-types';

export interface ICustomerLifecycleSnapshot extends Document {
  customerId: Types.ObjectId;
  state: CustomerLifecycleState;
  previousState?: CustomerLifecycleState;
  reason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  calculatedAt: Date;
  updatedAt: Date;
}

const lifecycleSnapSchema = new Schema<ICustomerLifecycleSnapshot>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    state: { type: String, enum: Object.values(CustomerLifecycleState), required: true, index: true },
    previousState: { type: String, enum: Object.values(CustomerLifecycleState) },
    reason: { type: String, required: true },
    confidence: { type: Number, default: 0.8 },
    metadata: Schema.Types.Mixed,
    calculatedAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CustomerLifecycleSnapshot = mongoose.model<ICustomerLifecycleSnapshot>(
  'CustomerLifecycleSnapshot',
  lifecycleSnapSchema,
);

export interface ILifecycleThresholdConfig extends Document {
  key: string;
  thresholds: typeof DEFAULT_LIFECYCLE_THRESHOLDS;
  categoryId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  updatedAt: Date;
}

const thresholdSchema = new Schema<ILifecycleThresholdConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    thresholds: {
      type: Schema.Types.Mixed,
      default: DEFAULT_LIFECYCLE_THRESHOLDS,
    },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    cityId: { type: Schema.Types.ObjectId, ref: 'City' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const LifecycleThresholdConfig = mongoose.model<ILifecycleThresholdConfig>(
  'LifecycleThresholdConfig',
  thresholdSchema,
);

export interface ICustomerSegment extends Document {
  name: string;
  slug: string;
  description?: string;
  rules: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const segmentSchema = new Schema<ICustomerSegment>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    rules: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CustomerSegment = mongoose.model<ICustomerSegment>('CustomerSegment', segmentSchema);

export interface ICustomerChurnPrediction extends Document {
  customerId: Types.ObjectId;
  riskLevel: ChurnRiskLevel;
  riskScore: number;
  confidence: number;
  topFactors: string[];
  recommendedAction: string;
  modelVersion: string;
  calculatedAt: Date;
  updatedAt: Date;
}

const churnSchema = new Schema<ICustomerChurnPrediction>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    riskLevel: { type: String, enum: Object.values(ChurnRiskLevel), required: true, index: true },
    riskScore: { type: Number, required: true },
    confidence: { type: Number, default: 0.7 },
    topFactors: { type: [String], default: [] },
    recommendedAction: { type: String, required: true },
    modelVersion: { type: String, default: 'rule-v1' },
    calculatedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CustomerChurnPrediction = mongoose.model<ICustomerChurnPrediction>(
  'CustomerChurnPrediction',
  churnSchema,
);

export interface IMarketingConsent extends Document {
  customerId: Types.ObjectId;
  marketingOptIn: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  updatedAt: Date;
}

const consentSchema = new Schema<IMarketingConsent>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    marketingOptIn: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false },
    inAppEnabled: { type: Boolean, default: true },
    quietHoursStart: String,
    quietHoursEnd: String,
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const MarketingConsent = mongoose.model<IMarketingConsent>('MarketingConsent', consentSchema);

export interface ICommunicationLog extends Document {
  customerId: Types.ObjectId;
  channel: MarketingChannel;
  priority: string;
  campaignId?: Types.ObjectId;
  messageType: string;
  sentAt: Date;
  idempotencyKey: string;
}

const commLogSchema = new Schema<ICommunicationLog>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, enum: Object.values(MarketingChannel), required: true },
    priority: { type: String, required: true },
    campaignId: { type: Schema.Types.ObjectId },
    messageType: { type: String, required: true },
    sentAt: { type: Date, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: false },
);

export const CommunicationLog = mongoose.model<ICommunicationLog>('CommunicationLog', commLogSchema);

export interface IFrequencyPolicy extends Document {
  key: string;
  maxPerDay: number;
  maxPerWeek: number;
  maxMarketingPerDay: number;
  maxMarketingPerWeek: number;
  updatedAt: Date;
}

const freqPolicySchema = new Schema<IFrequencyPolicy>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    maxPerDay: { type: Number, default: 5 },
    maxPerWeek: { type: Number, default: 15 },
    maxMarketingPerDay: { type: Number, default: 1 },
    maxMarketingPerWeek: { type: Number, default: 3 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const RecommendationFrequencyPolicy = mongoose.model<IFrequencyPolicy>(
  'RecommendationFrequencyPolicy',
  freqPolicySchema,
);

export interface IServiceRecommendation extends Document {
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  reason: string;
  confidence: number;
  priority: number;
  source: ServiceRecommendationSource;
  status: ServiceRecommendationStatus;
  expiresAt: Date;
  dismissedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const svcRecSchema = new Schema<IServiceRecommendation>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    reason: { type: String, required: true },
    confidence: { type: Number, default: 0.7 },
    priority: { type: Number, default: 0 },
    source: { type: String, enum: Object.values(ServiceRecommendationSource), required: true },
    status: {
      type: String,
      enum: Object.values(ServiceRecommendationStatus),
      default: ServiceRecommendationStatus.ACTIVE,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    dismissedAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);
svcRecSchema.index({ customerId: 1, status: 1, expiresAt: 1 });

export const ServiceRecommendation = mongoose.model<IServiceRecommendation>(
  'ServiceRecommendation',
  svcRecSchema,
);

export interface ILoyaltyAccount extends Document {
  customerId: Types.ObjectId;
  points: number;
  tier: LoyaltyTier;
  lifetimePoints: number;
  updatedAt: Date;
}

const loyaltyAcctSchema = new Schema<ILoyaltyAccount>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    points: { type: Number, default: 0 },
    tier: { type: String, enum: Object.values(LoyaltyTier), default: LoyaltyTier.BRONZE },
    lifetimePoints: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const LoyaltyAccount = mongoose.model<ILoyaltyAccount>('LoyaltyAccount', loyaltyAcctSchema);

export interface ILoyaltyTransaction extends Document {
  accountId: Types.ObjectId;
  customerId: Types.ObjectId;
  type: LoyaltyEventType;
  points: number;
  balanceAfter: number;
  sourceType?: string;
  sourceId?: Types.ObjectId;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const loyaltyTxSchema = new Schema<ILoyaltyTransaction>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'LoyaltyAccount', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(LoyaltyEventType), required: true, index: true },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    sourceType: String,
    sourceId: Schema.Types.ObjectId,
    idempotencyKey: { type: String, required: true, unique: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
loyaltyTxSchema.index({ accountId: 1, type: 1, createdAt: -1 });

export const LoyaltyTransaction = mongoose.model<ILoyaltyTransaction>(
  'LoyaltyTransaction',
  loyaltyTxSchema,
);

export interface ILoyaltyReward extends Document {
  name: string;
  description: string;
  pointsCost: number;
  rewardType: string;
  eligibility: Record<string, unknown>;
  available: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

const loyaltyRewardSchema = new Schema<ILoyaltyReward>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    pointsCost: { type: Number, required: true },
    rewardType: { type: String, required: true },
    eligibility: { type: Schema.Types.Mixed, default: {} },
    available: { type: Boolean, default: true },
    expiresAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const LoyaltyReward = mongoose.model<ILoyaltyReward>('LoyaltyReward', loyaltyRewardSchema);

export interface ILifecycleCampaign extends Document {
  name: string;
  objective: LifecycleCampaignObjective;
  audience: Record<string, unknown>;
  trigger: string;
  channels: MarketingChannel[];
  content: Record<string, unknown>;
  frequencyPolicy?: Record<string, unknown>;
  startAt: Date;
  endAt: Date;
  status: LifecycleCampaignStatus;
  sentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ILifecycleCampaign>(
  {
    name: { type: String, required: true },
    objective: { type: String, enum: Object.values(LifecycleCampaignObjective), required: true },
    audience: { type: Schema.Types.Mixed, default: {} },
    trigger: { type: String, required: true },
    channels: { type: [String], enum: Object.values(MarketingChannel), default: [MarketingChannel.IN_APP] },
    content: { type: Schema.Types.Mixed, default: {} },
    frequencyPolicy: Schema.Types.Mixed,
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(LifecycleCampaignStatus),
      default: LifecycleCampaignStatus.DRAFT,
      index: true,
    },
    sentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const LifecycleCampaign = mongoose.model<ILifecycleCampaign>(
  'LifecycleCampaign',
  campaignSchema,
);

export interface IReactivationCampaign extends Document {
  name: string;
  trigger: ReactivationTrigger;
  lifecycleStates: CustomerLifecycleState[];
  campaignId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

const reactivationSchema = new Schema<IReactivationCampaign>(
  {
    name: { type: String, required: true },
    trigger: { type: String, enum: Object.values(ReactivationTrigger), required: true },
    lifecycleStates: { type: [String], enum: Object.values(CustomerLifecycleState), default: [] },
    campaignId: { type: Schema.Types.ObjectId, ref: 'LifecycleCampaign' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ReactivationCampaign = mongoose.model<IReactivationCampaign>(
  'ReactivationCampaign',
  reactivationSchema,
);

export interface IExperimentAssignment extends Document {
  experimentId: Types.ObjectId;
  customerId: Types.ObjectId;
  variant: string;
  assignedAt: Date;
}

const expAssignSchema = new Schema<IExperimentAssignment>(
  {
    experimentId: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    variant: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);
expAssignSchema.index({ experimentId: 1, customerId: 1 }, { unique: true });

export const ExperimentAssignment = mongoose.model<IExperimentAssignment>(
  'ExperimentAssignment',
  expAssignSchema,
);

export interface IMarketingTouchpoint extends Document {
  customerId?: Types.ObjectId;
  anonymousId?: string;
  campaignId?: Types.ObjectId;
  channel: MarketingChannel;
  eventType: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

const touchpointSchema = new Schema<IMarketingTouchpoint>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    anonymousId: { type: String, index: true },
    campaignId: { type: Schema.Types.ObjectId, index: true },
    channel: { type: String, enum: Object.values(MarketingChannel), required: true },
    eventType: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: false },
);
touchpointSchema.index({ campaignId: 1, customerId: 1, occurredAt: -1 });

export const MarketingTouchpoint = mongoose.model<IMarketingTouchpoint>(
  'MarketingTouchpoint',
  touchpointSchema,
);

export interface IReferralReview extends Document {
  referralRedemptionId: Types.ObjectId;
  status: ReferralReviewStatus;
  flags: string[];
  reviewedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const referralReviewSchema = new Schema<IReferralReview>(
  {
    referralRedemptionId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ReferralReviewStatus),
      default: ReferralReviewStatus.PENDING,
    },
    flags: { type: [String], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true },
);

export const ReferralReview = mongoose.model<IReferralReview>('ReferralReview', referralReviewSchema);

export interface ICohortSnapshot extends Document {
  cohortKey: string;
  periodStart: Date;
  periodEnd: Date;
  cohortSize: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  retentionD90: number;
  repeatRate: number;
  metadata?: Record<string, unknown>;
  calculatedAt: Date;
}

const cohortSchema = new Schema<ICohortSnapshot>(
  {
    cohortKey: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    cohortSize: { type: Number, default: 0 },
    retentionD1: { type: Number, default: 0 },
    retentionD7: { type: Number, default: 0 },
    retentionD30: { type: Number, default: 0 },
    retentionD90: { type: Number, default: 0 },
    repeatRate: { type: Number, default: 0 },
    metadata: Schema.Types.Mixed,
    calculatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);
cohortSchema.index({ cohortKey: 1, periodStart: 1 }, { unique: true });

export const CohortSnapshot = mongoose.model<ICohortSnapshot>('CohortSnapshot', cohortSchema);
