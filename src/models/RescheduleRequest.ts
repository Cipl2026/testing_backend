import mongoose, { type Document, Schema, Types } from 'mongoose';
import { RescheduleStatus } from '@ghaarfix/shared-types';

export interface IRescheduleRequest extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  originalStart: Date;
  originalEnd: Date;
  proposedStart: Date;
  proposedEnd: Date;
  reason?: string;
  status: RescheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

const rescheduleSchema = new Schema<IRescheduleRequest>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalStart: { type: Date, required: true },
    originalEnd: { type: Date, required: true },
    proposedStart: { type: Date, required: true },
    proposedEnd: { type: Date, required: true },
    reason: { type: String, maxlength: 500 },
    status: { type: String, enum: Object.values(RescheduleStatus), default: RescheduleStatus.PENDING, index: true },
  },
  { timestamps: true },
);

export const RescheduleRequest = mongoose.model<IRescheduleRequest>(
  'RescheduleRequest',
  rescheduleSchema,
);
