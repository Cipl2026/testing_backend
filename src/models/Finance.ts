import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  DEFAULT_CURRENCY,
  FinancialAdjustmentType,
  FinancialAlertSeverity,
  FinancialAlertStatus,
  FinancialDirection,
  FinancialEventStatus,
  FinancialEventType,
  FinancialSourceType,
  FinanceApprovalStatus,
  ForecastConfidence,
  ReconciliationStatus,
} from '@ghaarfix/shared-types';

export interface IFinancialEvent extends Document {
  eventType: FinancialEventType;
  sourceType: FinancialSourceType;
  sourceId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  providerId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  zoneId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  amountMinor: number;
  currency: string;
  direction: FinancialDirection;
  status: FinancialEventStatus;
  occurredAt: Date;
  effectiveAt: Date;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  reversalOf?: Types.ObjectId;
  createdAt: Date;
}

const eventSchema = new Schema<IFinancialEvent>(
  {
    eventType: { type: String, enum: Object.values(FinancialEventType), required: true, index: true },
    sourceType: { type: String, enum: Object.values(FinancialSourceType), required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
    direction: { type: String, enum: Object.values(FinancialDirection), required: true },
    status: {
      type: String,
      enum: Object.values(FinancialEventStatus),
      default: FinancialEventStatus.POSTED,
      index: true,
    },
    occurredAt: { type: Date, required: true, index: true },
    effectiveAt: { type: Date, required: true, index: true },
    metadata: Schema.Types.Mixed,
    idempotencyKey: { type: String, required: true, unique: true },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
eventSchema.index({ sourceType: 1, sourceId: 1 });
eventSchema.index({ eventType: 1, status: 1 });

export const FinancialEvent = mongoose.model<IFinancialEvent>('FinancialEvent', eventSchema);

export interface IBookingFinancialSnapshot extends Document {
  bookingId: Types.ObjectId;
  grossRevenueMinor: number;
  discountMinor: number;
  refundMinor: number;
  gatewayFeeMinor: number;
  providerCostMinor: number;
  partCostMinor: number;
  supportCostMinor?: number;
  guaranteeCostMinor: number;
  netRevenueMinor: number;
  contributionMarginMinor: number;
  currency: string;
  version: number;
  updatedAt: Date;
}

const bookingSnapSchema = new Schema<IBookingFinancialSnapshot>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    grossRevenueMinor: { type: Number, default: 0 },
    discountMinor: { type: Number, default: 0 },
    refundMinor: { type: Number, default: 0 },
    gatewayFeeMinor: { type: Number, default: 0 },
    providerCostMinor: { type: Number, default: 0 },
    partCostMinor: { type: Number, default: 0 },
    supportCostMinor: Number,
    guaranteeCostMinor: { type: Number, default: 0 },
    netRevenueMinor: { type: Number, default: 0 },
    contributionMarginMinor: { type: Number, default: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const BookingFinancialSnapshot = mongoose.model<IBookingFinancialSnapshot>(
  'BookingFinancialSnapshot',
  bookingSnapSchema,
);

export interface IServiceProfitabilitySnapshot extends Document {
  serviceId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  cityId?: Types.ObjectId;
  zoneId?: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  bookings: number;
  gmvMinor: number;
  netRevenueMinor: number;
  contributionMarginMinor: number;
  refundRate: number;
  claimCostMinor: number;
  avgProviderCostMinor: number;
  avgDiscountMinor: number;
  currency: string;
  updatedAt: Date;
}

const serviceProfitSchema = new Schema<IServiceProfitabilitySnapshot>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', index: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    bookings: { type: Number, default: 0 },
    gmvMinor: { type: Number, default: 0 },
    netRevenueMinor: { type: Number, default: 0 },
    contributionMarginMinor: { type: Number, default: 0 },
    refundRate: { type: Number, default: 0 },
    claimCostMinor: { type: Number, default: 0 },
    avgProviderCostMinor: { type: Number, default: 0 },
    avgDiscountMinor: { type: Number, default: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
serviceProfitSchema.index({ serviceId: 1, cityId: 1, periodStart: 1 });

export const ServiceProfitabilitySnapshot = mongoose.model<IServiceProfitabilitySnapshot>(
  'ServiceProfitabilitySnapshot',
  serviceProfitSchema,
);

export interface ICityFinancialSnapshot extends Document {
  cityId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  gmvMinor: number;
  revenueMinor: number;
  providerPayoutsMinor: number;
  refundsMinor: number;
  discountCostMinor: number;
  contributionMarginMinor: number;
  currency: string;
  updatedAt: Date;
}

const citySnapSchema = new Schema<ICityFinancialSnapshot>(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    gmvMinor: { type: Number, default: 0 },
    revenueMinor: { type: Number, default: 0 },
    providerPayoutsMinor: { type: Number, default: 0 },
    refundsMinor: { type: Number, default: 0 },
    discountCostMinor: { type: Number, default: 0 },
    contributionMarginMinor: { type: Number, default: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
citySnapSchema.index({ cityId: 1, periodStart: 1 }, { unique: true });

export const CityFinancialSnapshot = mongoose.model<ICityFinancialSnapshot>(
  'CityFinancialSnapshot',
  citySnapSchema,
);

export interface IProviderEarningsSnapshot extends Document {
  providerId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  grossEarningsMinor: number;
  platformDeductionsMinor: number;
  payoutPendingMinor: number;
  payoutCompletedMinor: number;
  adjustmentsMinor: number;
  currency: string;
  updatedAt: Date;
}

const providerEarnSchema = new Schema<IProviderEarningsSnapshot>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    grossEarningsMinor: { type: Number, default: 0 },
    platformDeductionsMinor: { type: Number, default: 0 },
    payoutPendingMinor: { type: Number, default: 0 },
    payoutCompletedMinor: { type: Number, default: 0 },
    adjustmentsMinor: { type: Number, default: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
providerEarnSchema.index({ providerId: 1, periodStart: 1 }, { unique: true });

export const ProviderEarningsSnapshot = mongoose.model<IProviderEarningsSnapshot>(
  'ProviderEarningsSnapshot',
  providerEarnSchema,
);

export interface IPayoutReconciliation extends Document {
  providerId: Types.ObjectId;
  payoutId: Types.ObjectId;
  expectedAmountMinor: number;
  actualAmountMinor: number;
  differenceMinor: number;
  status: ReconciliationStatus;
  reason?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutRecSchema = new Schema<IPayoutReconciliation>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payoutId: { type: Schema.Types.ObjectId, required: true, index: true },
    expectedAmountMinor: { type: Number, required: true },
    actualAmountMinor: { type: Number, default: 0 },
    differenceMinor: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ReconciliationStatus),
      default: ReconciliationStatus.PENDING,
      index: true,
    },
    reason: String,
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: true },
);

export const PayoutReconciliation = mongoose.model<IPayoutReconciliation>(
  'PayoutReconciliation',
  payoutRecSchema,
);

export interface IPaymentReconciliation extends Document {
  paymentId: Types.ObjectId;
  gatewayReference?: string;
  expectedAmountMinor: number;
  receivedAmountMinor: number;
  status: ReconciliationStatus;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRecSchema = new Schema<IPaymentReconciliation>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    gatewayReference: String,
    expectedAmountMinor: { type: Number, required: true },
    receivedAmountMinor: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ReconciliationStatus),
      default: ReconciliationStatus.PENDING,
    },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: true },
);

export const PaymentReconciliation = mongoose.model<IPaymentReconciliation>(
  'PaymentReconciliation',
  paymentRecSchema,
);

export interface IAcquisitionCostEvent extends Document {
  channel: string;
  campaignId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  costMinor: number;
  currency: string;
  occurredAt: Date;
  attributionConfidence: number;
  createdAt: Date;
}

const cacSchema = new Schema<IAcquisitionCostEvent>(
  {
    channel: { type: String, required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    costMinor: { type: Number, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
    occurredAt: { type: Date, required: true, index: true },
    attributionConfidence: { type: Number, default: 0.5 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AcquisitionCostEvent = mongoose.model<IAcquisitionCostEvent>(
  'AcquisitionCostEvent',
  cacSchema,
);

export interface ICustomerValueSnapshot extends Document {
  customerId: Types.ObjectId;
  completedBookings: number;
  netRevenueMinor: number;
  contributionMarginMinor: number;
  retentionRate: number;
  repeatRate: number;
  realizedLtvMinor: number;
  predictedLtvMinor?: number;
  ltvConfidence: number;
  currency: string;
  updatedAt: Date;
}

const ltvSchema = new Schema<ICustomerValueSnapshot>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    completedBookings: { type: Number, default: 0 },
    netRevenueMinor: { type: Number, default: 0 },
    contributionMarginMinor: { type: Number, default: 0 },
    retentionRate: { type: Number, default: 0 },
    repeatRate: { type: Number, default: 0 },
    realizedLtvMinor: { type: Number, default: 0 },
    predictedLtvMinor: Number,
    ltvConfidence: { type: Number, default: 0.5 },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CustomerValueSnapshot = mongoose.model<ICustomerValueSnapshot>(
  'CustomerValueSnapshot',
  ltvSchema,
);

export interface IRevenueRecognitionSchedule extends Document {
  sourceType: FinancialSourceType;
  sourceId: Types.ObjectId;
  amountMinor: number;
  currency: string;
  eventDate: Date;
  serviceCompletionDate?: Date;
  recognitionDate: Date;
  deferred: boolean;
  createdAt: Date;
}

const revRecSchema = new Schema<IRevenueRecognitionSchedule>(
  {
    sourceType: { type: String, enum: Object.values(FinancialSourceType), required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
    eventDate: { type: Date, required: true },
    serviceCompletionDate: Date,
    recognitionDate: { type: Date, required: true, index: true },
    deferred: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RevenueRecognitionSchedule = mongoose.model<IRevenueRecognitionSchedule>(
  'RevenueRecognitionSchedule',
  revRecSchema,
);

export interface ICashFlowForecast extends Document {
  periodStart: Date;
  periodEnd: Date;
  expectedInflowMinor: number;
  expectedOutflowMinor: number;
  netCashMinor: number;
  confidence: ForecastConfidence;
  rangeLowMinor: number;
  rangeHighMinor: number;
  currency: string;
  inputs: Record<string, unknown>;
  createdAt: Date;
}

const forecastSchema = new Schema<ICashFlowForecast>(
  {
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true },
    expectedInflowMinor: { type: Number, default: 0 },
    expectedOutflowMinor: { type: Number, default: 0 },
    netCashMinor: { type: Number, default: 0 },
    confidence: {
      type: String,
      enum: Object.values(ForecastConfidence),
      default: ForecastConfidence.MEDIUM,
    },
    rangeLowMinor: { type: Number, default: 0 },
    rangeHighMinor: { type: Number, default: 0 },
    currency: { type: String, default: DEFAULT_CURRENCY },
    inputs: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CashFlowForecast = mongoose.model<ICashFlowForecast>(
  'CashFlowForecast',
  forecastSchema,
);

export interface IFinancialAlert extends Document {
  scope: string;
  severity: FinancialAlertSeverity;
  metric: string;
  expectedValue?: number;
  actualValue?: number;
  anomalyScore: number;
  explanation: string;
  status: FinancialAlertStatus;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IFinancialAlert>(
  {
    scope: { type: String, required: true },
    severity: { type: String, enum: Object.values(FinancialAlertSeverity), required: true, index: true },
    metric: { type: String, required: true },
    expectedValue: Number,
    actualValue: Number,
    anomalyScore: { type: Number, default: 0 },
    explanation: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(FinancialAlertStatus),
      default: FinancialAlertStatus.OPEN,
      index: true,
    },
    dedupeKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);
alertSchema.index({ status: 1, severity: 1 });

export const FinancialAlert = mongoose.model<IFinancialAlert>('FinancialAlert', alertSchema);

export interface IFinancialTarget extends Document {
  scope: string;
  scopeId?: Types.ObjectId;
  metric: string;
  targetMinor: number;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  createdAt: Date;
}

const targetSchema = new Schema<IFinancialTarget>(
  {
    scope: { type: String, required: true },
    scopeId: { type: Schema.Types.ObjectId },
    metric: { type: String, required: true },
    targetMinor: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FinancialTarget = mongoose.model<IFinancialTarget>('FinancialTarget', targetSchema);

export interface IFinancialApproval extends Document {
  type: FinancialAdjustmentType;
  amountMinor: number;
  currency: string;
  reason: string;
  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  status: FinanceApprovalStatus;
  bookingId?: Types.ObjectId;
  providerId?: Types.ObjectId;
  thresholdMinor: number;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalSchema = new Schema<IFinancialApproval>(
  {
    type: { type: String, enum: Object.values(FinancialAdjustmentType), required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: DEFAULT_CURRENCY },
    reason: { type: String, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: Object.values(FinanceApprovalStatus),
      default: FinanceApprovalStatus.PENDING,
      index: true,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    providerId: { type: Schema.Types.ObjectId, ref: 'User' },
    thresholdMinor: { type: Number, default: 0 },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const FinancialApproval = mongoose.model<IFinancialApproval>(
  'FinancialApproval',
  approvalSchema,
);

export interface IFinanceOutbox extends Document {
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  attempts: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}

const outboxSchema = new Schema<IFinanceOutbox>(
  {
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: { type: String, default: 'PENDING', index: true },
    attempts: { type: Number, default: 0 },
    lastError: String,
    processedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FinanceOutbox = mongoose.model<IFinanceOutbox>('FinanceOutbox', outboxSchema);
