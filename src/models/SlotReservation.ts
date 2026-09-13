import mongoose, { type Document, Schema, Types } from 'mongoose';
import { SlotReservationStatus, type HomeHelpTaskPriority, type QuickServicesSnapshot } from '@ghaarfix/shared-types';

export interface HomeHelpReservationPayload {
  durationPackageId: Types.ObjectId;
  durationLabel: string;
  durationMinutes: number;
  quotedAmount: number;
  generalNotes?: string;
  tasks: Array<{
    serviceId: Types.ObjectId;
    name: string;
    priority: HomeHelpTaskPriority;
    notes?: string;
  }>;
}

export interface ISlotReservation extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  customerId: Types.ObjectId;
  addressId: Types.ObjectId;
  homeId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  startDateTime: Date;
  endDateTime: Date;
  status: SlotReservationStatus;
  expiresAt: Date;
  serviceZoneId?: Types.ObjectId;
  homeHelp?: HomeHelpReservationPayload;
  quickServices?: QuickServicesSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const slotReservationSchema = new Schema<ISlotReservation>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress', required: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home' },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset' },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SlotReservationStatus),
      default: SlotReservationStatus.HELD,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', sparse: true, index: true },
    homeHelp: {
      durationPackageId: { type: Schema.Types.ObjectId, ref: 'HomeHelpDurationPackage' },
      durationLabel: String,
      durationMinutes: Number,
      quotedAmount: Number,
      generalNotes: String,
      tasks: [
        {
          serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
          name: String,
          priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
          notes: String,
        },
      ],
    },
    quickServices: {
      bookingMode: { type: String, enum: ['instant', 'scheduled', 'recurring'] },
      photoUrls: { type: [String], default: undefined },
    },
  },
  { timestamps: true },
);

slotReservationSchema.index({ providerId: 1, startDateTime: 1 });
slotReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SlotReservation = mongoose.model<ISlotReservation>(
  'SlotReservation',
  slotReservationSchema,
);
