import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  RewardLedgerStatus,
  RewardLedgerType,
  RewardSourceType,
} from '@ghaarfix/shared-types';

export interface IRewardLedger extends Document {
  customerId: Types.ObjectId;
  type: RewardLedgerType;
  amount: number;
  status: RewardLedgerStatus;
  sourceType: RewardSourceType;
  sourceId: string;
  expiresAt?: Date;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const rewardLedgerSchema = new Schema<IRewardLedger>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(RewardLedgerType), required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(RewardLedgerStatus),
      default: RewardLedgerStatus.COMPLETED,
      index: true,
    },
    sourceType: { type: String, enum: Object.values(RewardSourceType), required: true },
    sourceId: { type: String, required: true },
    expiresAt: { type: Date, index: true },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

rewardLedgerSchema.index({ customerId: 1, createdAt: -1 });
rewardLedgerSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true, sparse: true });

export const RewardLedger = mongoose.model<IRewardLedger>('RewardLedger', rewardLedgerSchema);
