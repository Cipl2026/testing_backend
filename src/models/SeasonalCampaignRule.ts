import mongoose, { type Document, Schema, Types } from 'mongoose';
import { SeasonName } from '@ghaarfix/shared-types';

export interface ISeasonalCampaignRule extends Document {
  name: string;
  season?: SeasonName;
  serviceIds: Types.ObjectId[];
  regions: string[];
  startDate: Date;
  endDate: Date;
  priority: number;
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const seasonalCampaignRuleSchema = new Schema<ISeasonalCampaignRule>(
  {
    name: { type: String, required: true, trim: true },
    season: { type: String, enum: Object.values(SeasonName) },
    serviceIds: { type: [Schema.Types.ObjectId], ref: 'Service', default: [] },
    regions: { type: [String], default: [] },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    priority: { type: Number, default: 0 },
    message: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const SeasonalCampaignRule = mongoose.model<ISeasonalCampaignRule>(
  'SeasonalCampaignRule',
  seasonalCampaignRuleSchema,
);
