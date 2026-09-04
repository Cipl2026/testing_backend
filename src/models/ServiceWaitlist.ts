import mongoose, { type Document, Schema, Types } from 'mongoose';
import { WaitlistStatus, WaitlistUrgency } from '@ghaarfix/shared-types';

export interface IServiceWaitlist extends Document {
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceZoneId: Types.ObjectId;
  addressId: Types.ObjectId;
  status: WaitlistStatus;
  urgency: WaitlistUrgency;
  preferredDate?: string;
  notes?: string;
  dedupeKey: string;
  matchedAt?: Date;
  notifiedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceWaitlistSchema = new Schema<IServiceWaitlist>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress', required: true },
    status: {
      type: String,
      enum: Object.values(WaitlistStatus),
      default: WaitlistStatus.PENDING,
      index: true,
    },
    urgency: {
      type: String,
      enum: Object.values(WaitlistUrgency),
      default: WaitlistUrgency.NORMAL,
      index: true,
    },
    preferredDate: { type: String },
    notes: { type: String, maxlength: 500 },
    dedupeKey: { type: String, required: true, index: true },
    matchedAt: Date,
    notifiedAt: Date,
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

serviceWaitlistSchema.index({ customerId: 1, dedupeKey: 1 }, { unique: true });
serviceWaitlistSchema.index({ serviceZoneId: 1, serviceId: 1, status: 1, urgency: -1 });

export const ServiceWaitlist = mongoose.model<IServiceWaitlist>(
  'ServiceWaitlist',
  serviceWaitlistSchema,
);
