import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IAssetType extends Document {
  slug: string;
  name: string;
  categoryId?: Types.ObjectId;
  icon?: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetTypeSchema = new Schema<IAssetType>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    icon: { type: String },
    description: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const AssetType = mongoose.model<IAssetType>('AssetType', assetTypeSchema);
