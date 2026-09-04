import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IZoneDemandMetric extends Document {
  serviceZoneId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  date: string;
  hour: number;
  requestCount: number;
  waitlistCount: number;
  bookingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const zoneDemandMetricSchema = new Schema<IZoneDemandMetric>(
  {
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', sparse: true, index: true },
    date: { type: String, required: true, index: true },
    hour: { type: Number, required: true, min: 0, max: 23 },
    requestCount: { type: Number, default: 0, min: 0 },
    waitlistCount: { type: Number, default: 0, min: 0 },
    bookingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

zoneDemandMetricSchema.index({ serviceZoneId: 1, serviceId: 1, date: 1, hour: 1 }, { unique: true });

export const ZoneDemandMetric = mongoose.model<IZoneDemandMetric>(
  'ZoneDemandMetric',
  zoneDemandMetricSchema,
);
