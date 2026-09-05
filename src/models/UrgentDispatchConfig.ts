import mongoose, { type Document, Schema } from 'mongoose';

/**
 * Single-document global urgent dispatch configuration, editable by admins at
 * runtime. Falls back to env defaults when the document is absent.
 */
export interface IUrgentDispatchConfig extends Document {
  key: string;
  invitationTtlSeconds?: number;
  waveIntervalSeconds?: number;
  batchSize?: number;
  retryCooldownSeconds?: number;
  noShowMinutes?: number;
  maxRadiusKm?: number;
  maxBroadcastProviders?: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const urgentDispatchConfigSchema = new Schema<IUrgentDispatchConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global', index: true },
    invitationTtlSeconds: Number,
    waveIntervalSeconds: Number,
    batchSize: Number,
    retryCooldownSeconds: Number,
    noShowMinutes: Number,
    maxRadiusKm: Number,
    maxBroadcastProviders: Number,
    updatedBy: String,
  },
  { timestamps: true },
);

export const UrgentDispatchConfig = mongoose.model<IUrgentDispatchConfig>(
  'UrgentDispatchConfig',
  urgentDispatchConfigSchema,
);