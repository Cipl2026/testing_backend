import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IUrgentIdempotency extends Document {
  customerId: Types.ObjectId;
  key: string;
  urgentRequestId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const urgentIdempotencySchema = new Schema<IUrgentIdempotency>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    urgentRequestId: { type: Schema.Types.ObjectId, ref: 'UrgentRequest' },
  },
  { timestamps: true },
);

urgentIdempotencySchema.index({ customerId: 1, key: 1 }, { unique: true });

export const UrgentIdempotency = mongoose.model<IUrgentIdempotency>(
  'UrgentIdempotency',
  urgentIdempotencySchema,
);
