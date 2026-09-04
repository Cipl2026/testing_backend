import mongoose, { type Document, Schema } from 'mongoose';

export interface ISearchSynonym extends Document {
  term: string;
  synonyms: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const searchSynonymSchema = new Schema<ISearchSynonym>(
  {
    term: { type: String, required: true, unique: true, lowercase: true, trim: true },
    synonyms: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const SearchSynonym = mongoose.model<ISearchSynonym>('SearchSynonym', searchSynonymSchema);
