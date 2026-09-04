import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ProviderSkillLevel, ProviderSkillStatus } from '@ghaarfix/shared-types';

export interface IProviderSkill extends Document {
  providerId: Types.ObjectId;
  skillId: Types.ObjectId;
  level: ProviderSkillLevel;
  status: ProviderSkillStatus;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  expiresAt?: Date;
  documentUrl?: string;
  documentKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<IProviderSkill>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    level: { type: String, enum: Object.values(ProviderSkillLevel), default: ProviderSkillLevel.BEGINNER },
    status: {
      type: String,
      enum: Object.values(ProviderSkillStatus),
      default: ProviderSkillStatus.PENDING,
      index: true,
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
    documentUrl: { type: String },
    documentKey: { type: String },
  },
  { timestamps: true },
);

skillSchema.index({ providerId: 1, skillId: 1 }, { unique: true });

export const ProviderSkill = mongoose.model<IProviderSkill>('ProviderSkill', skillSchema);
