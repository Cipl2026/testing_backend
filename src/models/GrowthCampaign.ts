import mongoose, { type Document, Schema, Types } from 'mongoose';
import { CampaignChannel, CampaignStatus } from '@ghaarfix/shared-types';

export interface IGrowthCampaign extends Document {
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  serviceIds: Types.ObjectId[];
  regions: string[];
  audienceSegment: string;
  startAt: Date;
  endAt: Date;
  message: string;
  sentCount: number;
  lastSentAt?: Date;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const growthCampaignSchema = new Schema<IGrowthCampaign>(
  {
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true,
    },
    channel: { type: String, enum: Object.values(CampaignChannel), required: true },
    serviceIds: { type: [Schema.Types.ObjectId], ref: 'Service', default: [] },
    regions: { type: [String], default: [] },
    audienceSegment: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    message: { type: String, required: true, trim: true },
    sentCount: { type: Number, default: 0 },
    lastSentAt: { type: Date },
    dedupeKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

export const GrowthCampaign = mongoose.model<IGrowthCampaign>(
  'GrowthCampaign',
  growthCampaignSchema,
);
