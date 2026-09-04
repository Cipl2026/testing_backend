import mongoose, { type Document, Schema, Types } from 'mongoose';
import { PriceChangeStatus } from '@ghaarfix/shared-types';

export interface IPriceChangeRequest extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  originalAmount: number;
  proposedAmount: number;
  difference: number;
  reason?: string;
  items: string[];
  status: PriceChangeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const priceChangeSchema = new Schema<IPriceChangeRequest>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalAmount: { type: Number, required: true },
    proposedAmount: { type: Number, required: true },
    difference: { type: Number, required: true },
    reason: { type: String, maxlength: 500 },
    items: { type: [String], default: [] },
    status: { type: String, enum: Object.values(PriceChangeStatus), default: PriceChangeStatus.PENDING, index: true },
  },
  { timestamps: true },
);

export const PriceChangeRequest = mongoose.model<IPriceChangeRequest>(
  'PriceChangeRequest',
  priceChangeSchema,
);
