import mongoose, { type Document, Schema, Types } from 'mongoose';
import { BillingInterval, PlanScopeType, SubscriptionPlanStatus } from '@ghaarfix/shared-types';

export interface ISubscriptionPlan extends Document {
  name: string;
  slug: string;
  description?: string;
  status: SubscriptionPlanStatus;
  scopeType: PlanScopeType;
  maxHomes?: number;
  supportedZones: string[];
  currentVersion: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(SubscriptionPlanStatus),
      default: SubscriptionPlanStatus.DRAFT,
      index: true,
    },
    scopeType: { type: String, enum: Object.values(PlanScopeType), required: true },
    maxHomes: { type: Number, min: 1 },
    supportedZones: { type: [String], default: [] },
    currentVersion: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ status: 1, scopeType: 1 });

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>(
  'SubscriptionPlan',
  subscriptionPlanSchema,
);

export interface ISubscriptionPlanVersion extends Document {
  planId: Types.ObjectId;
  version: number;
  name: string;
  description?: string;
  scopeType: PlanScopeType;
  maxHomes?: number;
  supportedZones: string[];
  publishedAt: Date;
  createdAt: Date;
}

const subscriptionPlanVersionSchema = new Schema<ISubscriptionPlanVersion>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String },
    scopeType: { type: String, enum: Object.values(PlanScopeType), required: true },
    maxHomes: { type: Number },
    supportedZones: { type: [String], default: [] },
    publishedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

subscriptionPlanVersionSchema.index({ planId: 1, version: 1 }, { unique: true });

export const SubscriptionPlanVersion = mongoose.model<ISubscriptionPlanVersion>(
  'SubscriptionPlanVersion',
  subscriptionPlanVersionSchema,
);

export interface ISubscriptionPlanPrice extends Document {
  planId: Types.ObjectId;
  billingInterval: BillingInterval;
  amount: number;
  currency: string;
  validFrom: Date;
  validTo?: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

const subscriptionPlanPriceSchema = new Schema<ISubscriptionPlanPrice>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true },
    billingInterval: { type: String, enum: Object.values(BillingInterval), required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    validFrom: { type: Date, required: true },
    validTo: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

subscriptionPlanPriceSchema.index({ planId: 1, billingInterval: 1, isActive: 1 });

export const SubscriptionPlanPrice = mongoose.model<ISubscriptionPlanPrice>(
  'SubscriptionPlanPrice',
  subscriptionPlanPriceSchema,
);
