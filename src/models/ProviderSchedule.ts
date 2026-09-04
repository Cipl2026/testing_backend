import mongoose, { type Document, Schema, Types } from 'mongoose';
import type { DaySchedule, WeeklySchedule } from '@ghaarfix/shared-types';

export interface IProviderSchedule extends Document {
  providerId: Types.ObjectId;
  weeklySchedule: WeeklySchedule;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dayScheduleSchema = new Schema<DaySchedule>(
  {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
  },
  { _id: false },
);

const weeklyScheduleSchema = new Schema<WeeklySchedule>(
  {
    monday: { type: dayScheduleSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '18:00' }) },
    tuesday: { type: dayScheduleSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '18:00' }) },
    wednesday: { type: dayScheduleSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '18:00' }) },
    thursday: { type: dayScheduleSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '18:00' }) },
    friday: { type: dayScheduleSchema, default: () => ({ enabled: true, startTime: '09:00', endTime: '18:00' }) },
    saturday: { type: dayScheduleSchema, default: () => ({ enabled: false, startTime: '09:00', endTime: '18:00' }) },
    sunday: { type: dayScheduleSchema, default: () => ({ enabled: false, startTime: '09:00', endTime: '18:00' }) },
  },
  { _id: false },
);

const providerScheduleSchema = new Schema<IProviderSchedule>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    weeklySchedule: { type: weeklyScheduleSchema, required: true },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProviderSchedule = mongoose.model<IProviderSchedule>(
  'ProviderSchedule',
  providerScheduleSchema,
);
