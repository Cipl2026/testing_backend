import mongoose, { type Document, Schema, Types } from 'mongoose';
import { SlotReservationStatus } from '@ghaarfix/shared-types';

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
  },
  { timestamps: true },
);

slotReservationSchema.index({ providerId: 1, startDateTime: 1 });
slotReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SlotReservation = mongoose.model<ISlotReservation>(
  'SlotReservation',
  slotReservationSchema,
);
