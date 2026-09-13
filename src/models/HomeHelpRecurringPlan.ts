import mongoose, { type Document, Schema, Types } from 'mongoose';
import type { HomeHelpTaskPriority, QuickServicesRecurringSchedule } from '@ghaarfix/shared-types';

export enum HomeHelpRecurringPlanStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export interface IHomeHelpRecurringPlan extends Document {
  customerId: Types.ObjectId;
  addressId: Types.ObjectId;
  providerId?: Types.ObjectId;
  durationPackageId: Types.ObjectId;
  anchorServiceId: Types.ObjectId;
  tasks: Array<{
    serviceId: Types.ObjectId;
    name: string;
    priority: HomeHelpTaskPriority;
    notes?: string;
  }>;
  recurring: QuickServicesRecurringSchedule;
  generalNotes?: string;
  paymentMethod: string;
  status: HomeHelpRecurringPlanStatus;
  nextOccurrenceAt?: Date;
  lastBookingId?: Types.ObjectId;
  lastReservationId?: Types.ObjectId;
  occurrencesCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}

const homeHelpRecurringPlanSchema = new Schema<IHomeHelpRecurringPlan>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    durationPackageId: { type: Schema.Types.ObjectId, ref: 'HomeHelpDurationPackage', required: true },
    anchorServiceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    tasks: [
      {
        serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
        name: String,
        priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
        notes: String,
      },
    ],
    recurring: {
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'], required: true },
      startDate: { type: String, required: true },
      preferredTime: { type: String, required: true },
      endDate: String,
      untilCancelled: { type: Boolean, default: true },
    },
    generalNotes: String,
    paymentMethod: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(HomeHelpRecurringPlanStatus),
      default: HomeHelpRecurringPlanStatus.ACTIVE,
      index: true,
    },
    nextOccurrenceAt: { type: Date, index: true },
    lastBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    lastReservationId: { type: Schema.Types.ObjectId, ref: 'SlotReservation' },
    occurrencesCompleted: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const HomeHelpRecurringPlan = mongoose.model<IHomeHelpRecurringPlan>(
  'HomeHelpRecurringPlan',
  homeHelpRecurringPlanSchema,
);
