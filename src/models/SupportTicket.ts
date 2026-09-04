import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@ghaarfix/shared-types';

export interface TicketMessage {
  authorId: Types.ObjectId;
  authorRole: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNumber: string;
  bookingId?: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId?: Types.ObjectId;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  attachments: string[];
  status: SupportTicketStatus;
  resolution?: string;
  messages: TicketMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, enum: Object.values(SupportTicketCategory), required: true, index: true },
    priority: {
      type: String,
      enum: Object.values(SupportTicketPriority),
      default: SupportTicketPriority.NORMAL,
      index: true,
    },
    subject: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    attachments: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(SupportTicketStatus),
      default: SupportTicketStatus.OPEN,
      index: true,
    },
    resolution: { type: String, maxlength: 2000 },
    messages: [
      {
        authorId: Schema.Types.ObjectId,
        authorRole: String,
        body: String,
        isInternal: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

supportTicketSchema.index({ createdAt: -1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
