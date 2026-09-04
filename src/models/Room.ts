import mongoose, { type Document, Schema, Types } from 'mongoose';
import { RoomType } from '@ghaarfix/shared-types';

export interface IRoom extends Document {
  homeId: Types.ObjectId;
  name: string;
  roomType: RoomType;
  floor?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    roomType: { type: String, enum: Object.values(RoomType), default: RoomType.OTHER },
    floor: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

roomSchema.index({ homeId: 1, name: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
