import mongoose, { type Document, Schema, Types } from 'mongoose';
import { TimelineEventType, UserRole } from '@ghaarfix/shared-types';

export interface IBookingTimelineEvent extends Document {
  bookingId: Types.ObjectId;
  type: TimelineEventType;
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const timelineSchema = new Schema<IBookingTimelineEvent>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    type: { type: String, enum: Object.values(TimelineEventType), required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: Object.values(UserRole) },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: false },
);

timelineSchema.index({ bookingId: 1, timestamp: 1 });

export const BookingTimelineEvent = mongoose.model<IBookingTimelineEvent>(
  'BookingTimelineEvent',
  timelineSchema,
);
