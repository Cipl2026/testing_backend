import mongoose, { type Document, Schema, Types } from 'mongoose';
import { HomeMemberRole, HomeMemberStatus } from '@ghaarfix/shared-types';

export interface IHomeMember extends Document {
  homeId: Types.ObjectId;
  customerId: Types.ObjectId;
  role: HomeMemberRole;
  status: HomeMemberStatus;
  invitedBy?: Types.ObjectId;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const homeMemberSchema = new Schema<IHomeMember>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: Object.values(HomeMemberRole), required: true, index: true },
    status: {
      type: String,
      enum: Object.values(HomeMemberStatus),
      default: HomeMemberStatus.ACTIVE,
      index: true,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date },
  },
  { timestamps: true },
);

homeMemberSchema.index({ homeId: 1, customerId: 1 }, { unique: true });
homeMemberSchema.index({ homeId: 1, role: 1 });

export const HomeMember = mongoose.model<IHomeMember>('HomeMember', homeMemberSchema);
