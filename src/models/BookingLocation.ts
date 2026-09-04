import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IBookingLocation extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  location: { type: 'Point'; coordinates: [number, number] };
  recordedAt: Date;
  source: string;
  accuracyMeters?: number;
  createdAt: Date;
}

const bookingLocationSchema = new Schema<IBookingLocation>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    recordedAt: { type: Date, required: true, index: true },
    source: { type: String, default: 'provider_app' },
    accuracyMeters: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookingLocationSchema.index({ bookingId: 1, recordedAt: -1 });
bookingLocationSchema.index({ location: '2dsphere' });

export const BookingLocation = mongoose.model<IBookingLocation>(
  'BookingLocation',
  bookingLocationSchema,
);
