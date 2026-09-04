import mongoose, { type Document, Schema, Types } from 'mongoose';
import { ServiceZoneType, ServiceZoneOperationalStatus, ZoneLaunchMode } from '@ghaarfix/shared-types';

export interface IServiceZone extends Document {
  name: string;
  slug: string;
  type: ServiceZoneType;
  cityId: Types.ObjectId;
  boundary?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  postalCodes: string[];
  priority: number;
  isActive: boolean;
  operationalStatus?: ServiceZoneOperationalStatus;
  launchMode?: ZoneLaunchMode;
  createdAt: Date;
  updatedAt: Date;
}

const serviceZoneSchema = new Schema<IServiceZone>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: Object.values(ServiceZoneType), required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    boundary: {
      type: { type: String, enum: ['Polygon'] },
      coordinates: [[[Number]]],
    },
    postalCodes: { type: [String], default: [] },
    priority: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    operationalStatus: {
      type: String,
      enum: Object.values(ServiceZoneOperationalStatus),
      default: ServiceZoneOperationalStatus.ACTIVE,
      index: true,
    },
    launchMode: {
      type: String,
      enum: Object.values(ZoneLaunchMode),
      default: ZoneLaunchMode.FULL_LAUNCH,
    },
  },
  { timestamps: true },
);

serviceZoneSchema.index({ boundary: '2dsphere' }, { sparse: true });
serviceZoneSchema.index({ postalCodes: 1 });
serviceZoneSchema.index({ cityId: 1, isActive: 1 });

export const ServiceZone = mongoose.model<IServiceZone>('ServiceZone', serviceZoneSchema);
