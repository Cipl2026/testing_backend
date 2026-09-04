import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface CompletionPart {
  name: string;
  quantity: number;
  amount: number;
}

export interface IServiceCompletion extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  summary: string;
  parts: CompletionPart[];
  recommendations?: string;
  checklist: {
    serviceCompleted: boolean;
    workAreaCleaned: boolean;
    customerInformed: boolean;
    photosAttached: boolean;
  };
  declaredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceCompletionSchema = new Schema<IServiceCompletion>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    summary: { type: String, required: true, maxlength: 2000 },
    parts: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    recommendations: { type: String, maxlength: 1000 },
    checklist: {
      serviceCompleted: { type: Boolean, default: false },
      workAreaCleaned: { type: Boolean, default: false },
      customerInformed: { type: Boolean, default: false },
      photosAttached: { type: Boolean, default: false },
    },
    declaredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ServiceCompletion = mongoose.model<IServiceCompletion>(
  'ServiceCompletion',
  serviceCompletionSchema,
);
