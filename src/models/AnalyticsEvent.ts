import mongoose, { type Document, Schema, Types } from 'mongoose';
import { AnalyticsEventName } from '@ghaarfix/shared-types';

export interface IAnalyticsEvent extends Document {
  eventName: AnalyticsEventName;
  customerId?: Types.ObjectId;
  providerId?: Types.ObjectId;
  bookingId?: Types.ObjectId;
  properties: Record<string, unknown>;
  occurredAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    eventName: { type: String, enum: Object.values(AnalyticsEventName), required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false },
);

analyticsEventSchema.index({ eventName: 1, occurredAt: -1 });
analyticsEventSchema.index({ customerId: 1, occurredAt: -1 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>(
  'AnalyticsEvent',
  analyticsEventSchema,
);
