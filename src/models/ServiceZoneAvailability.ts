import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IServiceZoneAvailability extends Document {
  serviceZoneId: Types.ObjectId;
  serviceId: Types.ObjectId;
  isAvailable: boolean;
  capacityHint?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceZoneAvailabilitySchema = new Schema<IServiceZoneAvailability>(
  {
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    capacityHint: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

serviceZoneAvailabilitySchema.index({ serviceZoneId: 1, serviceId: 1 }, { unique: true });

export const ServiceZoneAvailability = mongoose.model<IServiceZoneAvailability>(
  'ServiceZoneAvailability',
  serviceZoneAvailabilitySchema,
);
