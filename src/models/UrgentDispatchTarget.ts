import mongoose, { type Document, Schema, Types } from 'mongoose';
import { UrgentDispatchTargetStatus } from '@ghaarfix/shared-types';

export interface IUrgentDispatchTarget extends Document {
  urgentRequestId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: UrgentDispatchTargetStatus;
  distanceMeters: number;
  rankScore: number;
  notifiedAt?: Date;
  seenAt?: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const urgentDispatchTargetSchema = new Schema<IUrgentDispatchTarget>(
  {
    urgentRequestId: { type: Schema.Types.ObjectId, ref: 'UrgentRequest', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(UrgentDispatchTargetStatus),
      required: true,
      index: true,
    },
    distanceMeters: { type: Number, required: true },
    rankScore: { type: Number, required: true },
    notifiedAt: Date,
    seenAt: Date,
    respondedAt: Date,
  },
  { timestamps: true },
);

urgentDispatchTargetSchema.index({ urgentRequestId: 1, providerId: 1 }, { unique: true });
urgentDispatchTargetSchema.index({ providerId: 1, status: 1 });

export const UrgentDispatchTarget = mongoose.model<IUrgentDispatchTarget>(
  'UrgentDispatchTarget',
  urgentDispatchTargetSchema,
);
