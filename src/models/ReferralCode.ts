import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ReferralCodeStatus } from '@ghaarfix/shared-types';

export interface IReferralCode extends Document {
  customerId: Types.ObjectId;
  code: string;
  status: ReferralCodeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const referralCodeSchema = new Schema<IReferralCode>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ReferralCodeStatus),
      default: ReferralCodeStatus.ACTIVE,
      index: true,
    },
  },
  { timestamps: true },
);

export const ReferralCode = mongoose.model<IReferralCode>('ReferralCode', referralCodeSchema);
