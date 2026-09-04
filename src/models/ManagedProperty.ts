import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ManagedPropertyStatus,
  ManagedPropertyType,
  PropertyOccupantStatus,
  PropertyOccupantType,
  PropertyUnitStatus,
  PropertyHealthStatus,
} from '@ghaarfix/shared-types';

export interface IManagedProperty extends Document {
  organizationId: Types.ObjectId;
  name: string;
  type: ManagedPropertyType;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  location?: { type: 'Point'; coordinates: [number, number] };
  cityId?: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  homeId?: Types.ObjectId;
  status: ManagedPropertyStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const managedPropertySchema = new Schema<IManagedProperty>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(ManagedPropertyType), required: true },
    address: {
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: 'IN' },
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' },
    },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', index: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', sparse: true },
    status: {
      type: String,
      enum: Object.values(ManagedPropertyStatus),
      default: ManagedPropertyStatus.ACTIVE,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

managedPropertySchema.index({ organizationId: 1, status: 1 });

export const ManagedProperty = mongoose.model<IManagedProperty>('ManagedProperty', managedPropertySchema);

export interface IPropertyUnit extends Document {
  propertyId: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  unitNumber: string;
  floor?: string;
  type?: string;
  status: PropertyUnitStatus;
  occupantCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const propertyUnitSchema = new Schema<IPropertyUnit>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    unitNumber: { type: String, required: true },
    floor: String,
    type: String,
    status: {
      type: String,
      enum: Object.values(PropertyUnitStatus),
      default: PropertyUnitStatus.ACTIVE,
    },
    occupantCount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

propertyUnitSchema.index({ propertyId: 1, unitNumber: 1 }, { unique: true });

export const PropertyUnit = mongoose.model<IPropertyUnit>('PropertyUnit', propertyUnitSchema);

export interface IPropertyOccupant extends Document {
  organizationId: Types.ObjectId;
  propertyId: Types.ObjectId;
  unitId?: Types.ObjectId;
  userId?: Types.ObjectId;
  nameSnapshot: string;
  phoneSnapshot?: string;
  type: PropertyOccupantType;
  status: PropertyOccupantStatus;
  createdAt: Date;
  updatedAt: Date;
}

const propertyOccupantSchema = new Schema<IPropertyOccupant>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true, index: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'PropertyUnit', sparse: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true, index: true },
    nameSnapshot: { type: String, required: true },
    phoneSnapshot: String,
    type: { type: String, enum: Object.values(PropertyOccupantType), required: true },
    status: {
      type: String,
      enum: Object.values(PropertyOccupantStatus),
      default: PropertyOccupantStatus.ACTIVE,
    },
  },
  { timestamps: true },
);

export const PropertyOccupant = mongoose.model<IPropertyOccupant>(
  'PropertyOccupant',
  propertyOccupantSchema,
);

export interface IPropertyHealthScore extends Document {
  organizationId: Types.ObjectId;
  propertyId: Types.ObjectId;
  score: number;
  status: PropertyHealthStatus;
  reasons: string[];
  calculatedAt: Date;
}

const propertyHealthSchema = new Schema<IPropertyHealthScore>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true, unique: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, enum: Object.values(PropertyHealthStatus), required: true },
  reasons: { type: [String], default: [] },
  calculatedAt: { type: Date, default: Date.now },
});

export const PropertyHealthScore = mongoose.model<IPropertyHealthScore>(
  'PropertyHealthScore',
  propertyHealthSchema,
);
