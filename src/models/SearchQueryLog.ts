import mongoose, { type Document, Schema, Types } from 'mongoose';
import { SearchResultType } from '@ghaarfix/shared-types';

export interface ISearchQueryLog extends Document {
  query: string;
  normalizedQuery: string;
  customerId?: Types.ObjectId;
  resultCount: number;
  selectedResultType?: SearchResultType;
  selectedResultId?: Types.ObjectId;
  isZeroResult: boolean;
  createdAt: Date;
}

const searchQueryLogSchema = new Schema<ISearchQueryLog>(
  {
    query: { type: String, required: true, trim: true },
    normalizedQuery: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    resultCount: { type: Number, required: true, default: 0 },
    selectedResultType: { type: String, enum: Object.values(SearchResultType) },
    selectedResultId: { type: Schema.Types.ObjectId },
    isZeroResult: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

searchQueryLogSchema.index({ isZeroResult: 1, normalizedQuery: 1 });

export const SearchQueryLog = mongoose.model<ISearchQueryLog>(
  'SearchQueryLog',
  searchQueryLogSchema,
);
