import mongoose, { type Document, Schema, Types } from 'mongoose';
import { BookingMessageAuthorRole } from '@ghaarfix/shared-types';

export interface IBookingMessage extends Document {
  bookingId: Types.ObjectId;
  authorId?: Types.ObjectId;
  authorRole: BookingMessageAuthorRole;
  body: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookingMessageSchema = new Schema<IBookingMessage>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorRole: {
      type: String,
      enum: Object.values(BookingMessageAuthorRole),
      required: true,
    },
    body: { type: String, required: true, maxlength: 2000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

bookingMessageSchema.index({ bookingId: 1, createdAt: 1 });

export const BookingMessage = mongoose.model<IBookingMessage>('BookingMessage', bookingMessageSchema);
