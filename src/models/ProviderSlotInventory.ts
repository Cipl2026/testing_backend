import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IProviderSlotInventory extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  date: string;
  slotStart: Date;
  capacity: number;
  reserved: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerSlotInventorySchema = new Schema<IProviderSlotInventory>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', sparse: true, index: true },
    date: { type: String, required: true, index: true },
    slotStart: { type: Date, required: true, index: true },
    capacity: { type: Number, required: true, min: 1 },
    reserved: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

providerSlotInventorySchema.index(
  { providerId: 1, serviceId: 1, slotStart: 1 },
  { unique: true },
);

export const ProviderSlotInventory = mongoose.model<IProviderSlotInventory>(
  'ProviderSlotInventory',
  providerSlotInventorySchema,
);
