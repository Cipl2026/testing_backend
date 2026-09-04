import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface ServiceRecordPart {
  name: string;
  quantity: number;
  amount: number;
}

export interface IAssetServiceRecord extends Document {
  assetId: Types.ObjectId;
  bookingId: Types.ObjectId;
  serviceId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceType: string;
  summary: string;
  parts: ServiceRecordPart[];
  cost: number;
  performedAt: Date;
  nextMaintenanceDate?: Date;
  createdAt: Date;
}

const assetServiceRecordSchema = new Schema<IAssetServiceRecord>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    serviceType: { type: String, required: true },
    summary: { type: String, required: true },
    parts: [
      {
        name: String,
        quantity: Number,
        amount: Number,
      },
    ],
    cost: { type: Number, required: true, min: 0 },
    performedAt: { type: Date, required: true, index: true },
    nextMaintenanceDate: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

assetServiceRecordSchema.index({ assetId: 1, performedAt: -1 });

export const AssetServiceRecord = mongoose.model<IAssetServiceRecord>(
  'AssetServiceRecord',
  assetServiceRecordSchema,
);
