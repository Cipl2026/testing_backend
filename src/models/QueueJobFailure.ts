import mongoose, { type Document, Schema } from 'mongoose';
import { QueueJobStatus, QueueName } from '@ghaarfix/shared-types';

export interface IQueueJobFailure extends Document {
  queueName: QueueName;
  jobId: string;
  jobName: string;
  payload: Record<string, unknown>;
  error: string;
  attempts: number;
  status: QueueJobStatus;
  failedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const queueJobFailureSchema = new Schema<IQueueJobFailure>(
  {
    queueName: { type: String, enum: Object.values(QueueName), required: true, index: true },
    jobId: { type: String, required: true, index: true },
    jobName: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, required: true },
    attempts: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: Object.values(QueueJobStatus),
      default: QueueJobStatus.DEAD_LETTER,
      index: true,
    },
    failedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

queueJobFailureSchema.index({ queueName: 1, jobId: 1 }, { unique: true });

export const QueueJobFailure = mongoose.model<IQueueJobFailure>(
  'QueueJobFailure',
  queueJobFailureSchema,
);
