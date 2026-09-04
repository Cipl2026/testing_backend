import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  BookingParticipantPermission,
  BookingParticipantRole,
} from '@ghaarfix/shared-types';

export interface IBookingParticipant extends Document {
  bookingId: Types.ObjectId;
  customerId?: Types.ObjectId;
  homeId?: Types.ObjectId;
  role: BookingParticipantRole;
  permissions: BookingParticipantPermission[];
  addedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<IBookingParticipant>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home' },
    role: { type: String, enum: Object.values(BookingParticipantRole), required: true, index: true },
    permissions: {
      type: [String],
      enum: Object.values(BookingParticipantPermission),
      default: [],
    },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

participantSchema.index({ bookingId: 1, customerId: 1 }, { unique: true, sparse: true });

export const BookingParticipant = mongoose.model<IBookingParticipant>(
  'BookingParticipant',
  participantSchema,
);
