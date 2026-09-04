import mongoose, { type Document, Schema, Types } from 'mongoose';
import { MaintenancePriority } from '@ghaarfix/shared-types';

export interface IMaintenanceTemplate extends Document {
  assetTypeId: Types.ObjectId;
  serviceId: Types.ObjectId;
  title: string;
  intervalDays: number;
  priority: MaintenancePriority;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceTemplateSchema = new Schema<IMaintenanceTemplate>(
  {
    assetTypeId: { type: Schema.Types.ObjectId, ref: 'AssetType', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    title: { type: String, required: true, trim: true },
    intervalDays: { type: Number, required: true, min: 1 },
    priority: {
      type: String,
      enum: Object.values(MaintenancePriority),
      default: MaintenancePriority.NORMAL,
    },
    description: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const MaintenanceTemplate = mongoose.model<IMaintenanceTemplate>(
  'MaintenanceTemplate',
  maintenanceTemplateSchema,
);
