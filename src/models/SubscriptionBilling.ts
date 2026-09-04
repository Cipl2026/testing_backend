import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  SubscriptionChangeType,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentAttemptStatus,
} from '@ghaarfix/shared-types';

export interface ISubscriptionInvoice extends Document {
  subscriptionId: Types.ObjectId;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  currency: string;
  status: SubscriptionInvoiceStatus;
  dueAt: Date;
  paidAt?: Date;
  paymentReference?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionInvoiceSchema = new Schema<ISubscriptionInvoice>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionInvoiceStatus),
      default: SubscriptionInvoiceStatus.DRAFT,
      index: true,
    },
    dueAt: { type: Date, required: true },
    paidAt: { type: Date },
    paymentReference: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

subscriptionInvoiceSchema.index({ subscriptionId: 1, periodStart: 1 }, { unique: true });

export const SubscriptionInvoice = mongoose.model<ISubscriptionInvoice>(
  'SubscriptionInvoice',
  subscriptionInvoiceSchema,
);

export interface ISubscriptionPaymentAttempt extends Document {
  subscriptionId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  amount: number;
  currency: string;
  status: SubscriptionPaymentAttemptStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  attemptNumber: number;
  errorMessage?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPaymentAttemptSchema = new Schema<ISubscriptionPaymentAttempt>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'SubscriptionInvoice', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionPaymentAttemptStatus),
      default: SubscriptionPaymentAttemptStatus.PENDING,
      index: true,
    },
    providerOrderId: { type: String, sparse: true },
    providerPaymentId: { type: String, sparse: true },
    attemptNumber: { type: Number, default: 1 },
    errorMessage: { type: String },
    idempotencyKey: { type: String, sparse: true, unique: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const SubscriptionPaymentAttempt = mongoose.model<ISubscriptionPaymentAttempt>(
  'SubscriptionPaymentAttempt',
  subscriptionPaymentAttemptSchema,
);

export interface ISubscriptionChange extends Document {
  subscriptionId: Types.ObjectId;
  type: SubscriptionChangeType;
  previousPlanId?: Types.ObjectId;
  newPlanId?: Types.ObjectId;
  effectiveAt: Date;
  reason?: string;
  createdBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const subscriptionChangeSchema = new Schema<ISubscriptionChange>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    type: { type: String, enum: Object.values(SubscriptionChangeType), required: true },
    previousPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    newPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    effectiveAt: { type: Date, required: true, index: true },
    reason: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SubscriptionChange = mongoose.model<ISubscriptionChange>(
  'SubscriptionChange',
  subscriptionChangeSchema,
);
