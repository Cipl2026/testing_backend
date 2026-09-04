import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IUrgentAcceptIdempotency extends Document {
  providerId: Types.ObjectId;
  urgentRequestId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const urgentAcceptIdempotencySchema = new Schema<IUrgentAcceptIdempotency>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    urgentRequestId: { type: Schema.Types.ObjectId, ref: 'UrgentRequest', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true },
);

urgentAcceptIdempotencySchema.index({ providerId: 1, urgentRequestId: 1 }, { unique: true });

export const UrgentAcceptIdempotency = mongoose.model<IUrgentAcceptIdempotency>(
  'UrgentAcceptIdempotency',
  urgentAcceptIdempotencySchema,
);
