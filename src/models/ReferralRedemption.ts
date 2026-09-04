import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ReferralRedemptionStatus } from '@ghaarfix/shared-types';

export interface IReferralRedemption extends Document {
  referrerId: Types.ObjectId;
  referredCustomerId: Types.ObjectId;
  referralCodeId: Types.ObjectId;
  status: ReferralRedemptionStatus;
  qualifiedAt?: Date;
  rewardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const referralRedemptionSchema = new Schema<IReferralRedemption>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    referralCodeId: { type: Schema.Types.ObjectId, ref: 'ReferralCode', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ReferralRedemptionStatus),
      default: ReferralRedemptionStatus.PENDING,
      index: true,
    },
    qualifiedAt: { type: Date },
    rewardedAt: { type: Date },
  },
  { timestamps: true },
);

export const ReferralRedemption = mongoose.model<IReferralRedemption>(
  'ReferralRedemption',
  referralRedemptionSchema,
);
