import mongoose, { type Document, Schema, Types } from 'mongoose';
import { HomeInvitationStatus, HomeMemberRole } from '@ghaarfix/shared-types';

export interface IHomeMemberInvitation extends Document {
  homeId: Types.ObjectId;
  invitedBy: Types.ObjectId;
  phoneHash?: string;
  emailNormalized?: string;
  role: HomeMemberRole;
  tokenHash: string;
  status: HomeInvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IHomeMemberInvitation>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    phoneHash: { type: String, index: true },
    emailNormalized: { type: String, lowercase: true, trim: true, index: true },
    role: { type: String, enum: Object.values(HomeMemberRole), required: true },
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(HomeInvitationStatus),
      default: HomeInvitationStatus.PENDING,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const HomeMemberInvitation = mongoose.model<IHomeMemberInvitation>(
  'HomeMemberInvitation',
  invitationSchema,
);
