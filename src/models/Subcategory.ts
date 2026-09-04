import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface ISubcategory extends Document {
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const subcategorySchema = new Schema<ISubcategory>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    image: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

subcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true });

export const Subcategory = mongoose.model<ISubcategory>('Subcategory', subcategorySchema);
