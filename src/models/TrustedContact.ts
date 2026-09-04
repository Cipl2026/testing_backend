import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface ITrustedContact extends Document {
  homeId: Types.ObjectId;
  customerId?: Types.ObjectId;
  name: string;
  phone: string;
  relationship?: string;
  isEmergencyContact: boolean;
  notificationPreferences: string[];
  createdAt: Date;
  updatedAt: Date;
}

const trustedContactSchema = new Schema<ITrustedContact>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true },
    isEmergencyContact: { type: Boolean, default: false },
    notificationPreferences: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const TrustedContact = mongoose.model<ITrustedContact>('TrustedContact', trustedContactSchema);
