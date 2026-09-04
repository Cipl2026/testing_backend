import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IGuestBookingRecipient extends Document {
  bookingId: Types.ObjectId;
  name: string;
  phone: string;
  relationship?: string;
  createdAt: Date;
}

const guestSchema = new Schema<IGuestBookingRecipient>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const GuestBookingRecipient = mongoose.model<IGuestBookingRecipient>(
  'GuestBookingRecipient',
  guestSchema,
);
