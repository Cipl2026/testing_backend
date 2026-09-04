import mongoose, { type Document, Schema, Types } from 'mongoose';

/** Tracks sent maintenance/warranty reminders to prevent duplicates */
export interface IReminderLog extends Document {
  customerId: Types.ObjectId;
  entityType: 'MAINTENANCE' | 'WARRANTY';
  entityId: Types.ObjectId;
  reminderType: string;
  sentAt: Date;
}

const reminderLogSchema = new Schema<IReminderLog>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, enum: ['MAINTENANCE', 'WARRANTY'], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    reminderType: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

reminderLogSchema.index(
  { entityType: 1, entityId: 1, reminderType: 1 },
  { unique: true },
);

export const ReminderLog = mongoose.model<IReminderLog>('ReminderLog', reminderLogSchema);
