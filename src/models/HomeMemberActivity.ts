import mongoose, { type Document, Schema, Types } from 'mongoose';
import { HomeMemberActivityType } from '@ghaarfix/shared-types';

export interface IHomeMemberActivity extends Document {
  homeId: Types.ObjectId;
  actorId: Types.ObjectId;
  type: HomeMemberActivityType;
  targetCustomerId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<IHomeMemberActivity>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(HomeMemberActivityType), required: true },
    targetCustomerId: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

export const HomeMemberActivity = mongoose.model<IHomeMemberActivity>(
  'HomeMemberActivity',
  activitySchema,
);
