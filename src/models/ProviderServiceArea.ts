import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ServiceAreaType } from '@ghaarfix/shared-types';

export interface IProviderServiceArea extends Document {
  providerId: Types.ObjectId;
  name: string;
  type: ServiceAreaType;
  center: {
    latitude: number;
    longitude: number;
  };
  radiusKm: number;
  postalCodes: string[];
  serviceZoneId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  priority?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const providerServiceAreaSchema = new Schema<IProviderServiceArea>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(ServiceAreaType), required: true },
    center: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    radiusKm: { type: Number, min: 0, default: 10 },
    postalCodes: { type: [String], default: [] },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', sparse: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', sparse: true, index: true },
    priority: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

providerServiceAreaSchema.index(
  { providerId: 1, name: 1 },
  { unique: true },
);
providerServiceAreaSchema.index({
  'center.longitude': 1,
  'center.latitude': 1,
});

export const ProviderServiceArea = mongoose.model<IProviderServiceArea>(
  'ProviderServiceArea',
  providerServiceAreaSchema,
);
