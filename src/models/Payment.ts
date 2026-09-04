import mongoose, { type Document, Schema, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@ghaarfix/shared-types';

export interface IPayment extends Document {
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: Object.values(PaymentMethod), required: true },
    provider: { type: String, default: 'razorpay' },
    providerOrderId: { type: String, sparse: true },
    providerPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: Object.values(PaymentStatus), required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
