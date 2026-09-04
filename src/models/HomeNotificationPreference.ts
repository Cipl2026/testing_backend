import mongoose, { type Document, Schema, Types } from 'mongoose';
import { HomeNotificationEventType } from '@ghaarfix/shared-types';

export interface IHomeNotificationPreference extends Document {
  homeId: Types.ObjectId;
  customerId: Types.ObjectId;
  eventType: HomeNotificationEventType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const prefSchema = new Schema<IHomeNotificationPreference>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventType: { type: String, enum: Object.values(HomeNotificationEventType), required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

prefSchema.index({ homeId: 1, customerId: 1, eventType: 1 }, { unique: true });

export const HomeNotificationPreference = mongoose.model<IHomeNotificationPreference>(
  'HomeNotificationPreference',
  prefSchema,
);
