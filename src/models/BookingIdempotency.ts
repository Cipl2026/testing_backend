import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IBookingIdempotency extends Document {
  customerId: Types.ObjectId;
  key: string;
  bookingId?: Types.ObjectId;
  response?: Record<string, unknown>;
  createdAt: Date;
}

const idempotencySchema = new Schema<IBookingIdempotency>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    response: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: 86400 },
  },
  { timestamps: false },
);

idempotencySchema.index({ customerId: 1, key: 1 }, { unique: true });

export const BookingIdempotency = mongoose.model<IBookingIdempotency>(
  'BookingIdempotency',
  idempotencySchema,
);
