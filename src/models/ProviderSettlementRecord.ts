import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ProviderSettlementKind,
  ProviderSettlementPaymentChannel,
  ProviderSettlementStatus,
} from '@ghaarfix/shared-types';

export interface IProviderSettlementRecord extends Document {
  bookingId: Types.ObjectId;
  bookingNumber: string;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  kind: ProviderSettlementKind;
  paymentChannel: ProviderSettlementPaymentChannel;
  status: ProviderSettlementStatus;
  /** Amount admin must pay provider (online) or provider owes platform (cash commission) */
  settleAmount: number;
  providerPayoutAmount: number;
  platformFeeAmount: number;
  customerPaidAmount: number;
  currency: string;
  serviceName?: string;
  settledAt?: Date;
  settledBy?: Types.ObjectId;
  settlementReference?: string;
  adminNotes?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const providerSettlementSchema = new Schema<IProviderSettlementRecord>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    bookingNumber: { type: String, required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: Object.values(ProviderSettlementKind), required: true, index: true },
    paymentChannel: {
      type: String,
      enum: Object.values(ProviderSettlementPaymentChannel),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ProviderSettlementStatus),
      default: ProviderSettlementStatus.PENDING,
      index: true,
    },
    settleAmount: { type: Number, required: true },
    providerPayoutAmount: { type: Number, required: true },
    platformFeeAmount: { type: Number, required: true },
    customerPaidAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    serviceName: { type: String },
    settledAt: { type: Date },
    settledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    settlementReference: { type: String },
    adminNotes: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

providerSettlementSchema.index({ providerId: 1, status: 1, createdAt: -1 });

export const ProviderSettlementRecord = mongoose.model<IProviderSettlementRecord>(
  'ProviderSettlementRecord',
  providerSettlementSchema,
);
