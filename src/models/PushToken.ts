import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IPushToken extends Document {
  providerId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'unknown';
  deviceId?: string;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true, index: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'unknown'], default: 'unknown' },
    deviceId: String,
    isActive: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

pushTokenSchema.index({ token: 1 }, { unique: true });

export const PushToken = mongoose.model<IPushToken>('PushToken', pushTokenSchema);
