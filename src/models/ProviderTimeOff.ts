import mongoose, { type Document, Schema, Types } from 'mongoose';
import { TimeOffType } from '@ghaarfix/shared-types';

export interface IProviderTimeOff extends Document {
  providerId: Types.ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  reason?: string;
  type: TimeOffType;
  createdAt: Date;
  updatedAt: Date;
}

const providerTimeOffSchema = new Schema<IProviderTimeOff>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    type: { type: String, enum: Object.values(TimeOffType), default: TimeOffType.TIME_OFF },
  },
  { timestamps: true },
);

providerTimeOffSchema.index({ providerId: 1, startDateTime: 1 });

export const ProviderTimeOff = mongoose.model<IProviderTimeOff>(
  'ProviderTimeOff',
  providerTimeOffSchema,
);
