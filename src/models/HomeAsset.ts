import mongoose, { type Document, Schema, Types } from 'mongoose';
import { AssetCondition } from '@ghaarfix/shared-types';

export interface IHomeAsset extends Omit<Document, 'model'> {
  homeId: Types.ObjectId;
  customerId: Types.ObjectId;
  roomId?: Types.ObjectId;
  assetTypeId: Types.ObjectId;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  installedAt?: Date;
  condition: AssetCondition;
  photoUrl?: string;
  photoKey?: string;
  metadata?: Record<string, unknown>;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const homeAssetSchema = new Schema<IHomeAsset>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', index: true },
    assetTypeId: { type: Schema.Types.ObjectId, ref: 'AssetType', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    purchaseDate: { type: Date },
    purchasePrice: { type: Number, min: 0 },
    installedAt: { type: Date },
    condition: {
      type: String,
      enum: Object.values(AssetCondition),
      default: AssetCondition.UNKNOWN,
    },
    photoUrl: { type: String },
    photoKey: { type: String },
    metadata: { type: Schema.Types.Mixed },
    archivedAt: { type: Date, index: true },
  },
  { timestamps: true },
);

homeAssetSchema.index({ homeId: 1, archivedAt: 1 });

export const HomeAsset = mongoose.model<IHomeAsset>('HomeAsset', homeAssetSchema);
