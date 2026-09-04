import mongoose, { type Document, Schema } from 'mongoose';

export interface ICity extends Document {
  name: string;
  slug: string;
  state: string;
  country: string;
  center?: { latitude: number; longitude: number };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const citySchema = new Schema<ICity>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'IN', trim: true },
    center: {
      latitude: Number,
      longitude: Number,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

citySchema.index({ name: 1, state: 1 });

export const City = mongoose.model<ICity>('City', citySchema);
