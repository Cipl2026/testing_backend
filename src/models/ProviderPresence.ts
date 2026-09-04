import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderPresenceStatus } from '@ghaarfix/shared-types';

export interface IProviderPresence extends Document {
  providerId: Types.ObjectId;
  status: ProviderPresenceStatus;
  isOnline: boolean;
  urgentAvailable: boolean;
  lastSeenAt: Date;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationUpdatedAt?: Date;
  activeJobCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerPresenceSchema = new Schema<IProviderPresence>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(ProviderPresenceStatus),
      default: ProviderPresenceStatus.OFFLINE,
      index: true,
    },
    isOnline: { type: Boolean, default: false, index: true },
    urgentAvailable: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    currentLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number],
    },
    locationUpdatedAt: Date,
    activeJobCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

providerPresenceSchema.index({ currentLocation: '2dsphere' });

export const ProviderPresence = mongoose.model<IProviderPresence>(
  'ProviderPresence',
  providerPresenceSchema,
);
