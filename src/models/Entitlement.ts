import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  EntitlementOwnerType,
  EntitlementStatus,
  EntitlementUsageStatus,
  PlanBenefitType,
} from '@ghaarfix/shared-types';

export interface IEntitlement extends Document {
  subscriptionId: Types.ObjectId;
  benefitId: Types.ObjectId;
  ownerType: EntitlementOwnerType;
  ownerId: Types.ObjectId;
  type: PlanBenefitType;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  periodStart: Date;
  periodEnd: Date;
  expiresAt?: Date;
  status: EntitlementStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const entitlementSchema = new Schema<IEntitlement>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    benefitId: { type: Schema.Types.ObjectId, ref: 'PlanBenefit', required: true },
    ownerType: { type: String, enum: Object.values(EntitlementOwnerType), required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, enum: Object.values(PlanBenefitType), required: true },
    totalQuantity: { type: Number, required: true, min: 0 },
    usedQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    expiresAt: { type: Date, index: true },
    status: {
      type: String,
      enum: Object.values(EntitlementStatus),
      default: EntitlementStatus.ACTIVE,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

entitlementSchema.index({ subscriptionId: 1, status: 1, expiresAt: 1 });

export const Entitlement = mongoose.model<IEntitlement>('Entitlement', entitlementSchema);

export interface IEntitlementUsage extends Document {
  entitlementId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  status: EntitlementUsageStatus;
  reservedAt?: Date;
  consumedAt?: Date;
  releasedAt?: Date;
  amountApplied?: number;
  metadata?: Record<string, unknown>;
}

const entitlementUsageSchema = new Schema<IEntitlementUsage>(
  {
    entitlementId: { type: Schema.Types.ObjectId, ref: 'Entitlement', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(EntitlementUsageStatus),
      required: true,
      index: true,
    },
    reservedAt: { type: Date },
    consumedAt: { type: Date },
    releasedAt: { type: Date },
    amountApplied: { type: Number, min: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

entitlementUsageSchema.index({ entitlementId: 1, bookingId: 1 }, { unique: true });

export const EntitlementUsage = mongoose.model<IEntitlementUsage>(
  'EntitlementUsage',
  entitlementUsageSchema,
);

export interface IEntitlementAdjustment extends Document {
  entitlementId: Types.ObjectId;
  adminId: Types.ObjectId;
  delta: number;
  reason: string;
  previousUsedQuantity: number;
  newUsedQuantity: number;
  createdAt: Date;
}

const entitlementAdjustmentSchema = new Schema<IEntitlementAdjustment>(
  {
    entitlementId: { type: Schema.Types.ObjectId, ref: 'Entitlement', required: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    previousUsedQuantity: { type: Number, required: true },
    newUsedQuantity: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const EntitlementAdjustment = mongoose.model<IEntitlementAdjustment>(
  'EntitlementAdjustment',
  entitlementAdjustmentSchema,
);
