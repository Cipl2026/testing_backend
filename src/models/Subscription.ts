import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  BillingInterval,
  PlanScopeType,
  SubscriptionHomeStatus,
  SubscriptionStatus,
} from '@ghaarfix/shared-types';

export interface ISubscription extends Document {
  customerId: Types.ObjectId;
  planId: Types.ObjectId;
  planVersionId: Types.ObjectId;
  scopeType: PlanScopeType;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  priceSnapshot: { amount: number; currency: string };
  startedAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  nextBillingAt?: Date;
  cancelAtPeriodEnd: boolean;
  pausedAt?: Date;
  resumeAt?: Date;
  cancelledAt?: Date;
  gracePeriodEndsAt?: Date;
  pauseCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true },
    planVersionId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlanVersion', required: true },
    scopeType: { type: String, enum: Object.values(PlanScopeType), required: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
      index: true,
    },
    billingInterval: { type: String, enum: Object.values(BillingInterval), required: true },
    priceSnapshot: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    startedAt: { type: Date },
    currentPeriodStart: { type: Date, index: true },
    currentPeriodEnd: { type: Date, index: true },
    nextBillingAt: { type: Date, index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    pausedAt: { type: Date },
    resumeAt: { type: Date },
    cancelledAt: { type: Date },
    gracePeriodEndsAt: { type: Date },
    pauseCount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

subscriptionSchema.index({ customerId: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);

export interface ISubscriptionHome extends Document {
  subscriptionId: Types.ObjectId;
  homeId: Types.ObjectId;
  status: SubscriptionHomeStatus;
  addedAt: Date;
  removedAt?: Date;
}

const subscriptionHomeSchema = new Schema<ISubscriptionHome>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionHomeStatus),
      default: SubscriptionHomeStatus.ACTIVE,
    },
    addedAt: { type: Date, default: Date.now },
    removedAt: { type: Date },
  },
  { timestamps: true },
);

subscriptionHomeSchema.index({ subscriptionId: 1, homeId: 1 }, { unique: true });

export const SubscriptionHome = mongoose.model<ISubscriptionHome>(
  'SubscriptionHome',
  subscriptionHomeSchema,
);
