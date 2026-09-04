import mongoose, { type Document, Schema, Types } from 'mongoose';
import { InvoiceStatus, PaymentStatus } from '@ghaarfix/shared-types';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoiceSnapshot {
  customerName: string;
  customerPhone: string;
  providerName: string;
  serviceName: string;
  bookingNumber: string;
  serviceDate: Date;
  addressSummary: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  status: InvoiceStatus;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  urgentFee: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  snapshot: InvoiceSnapshot;
  pdfUrl?: string;
  pdfKey?: string;
  pdfGeneratedAt?: Date;
  pdfTemplateVersion?: number;
  issuedAt?: Date;
  dueAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(InvoiceStatus), required: true, index: true },
    currency: { type: String, default: 'INR' },
    lineItems: [
      {
        description: String,
        quantity: Number,
        unitAmount: Number,
        amount: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    urgentFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentStatus: { type: String, enum: Object.values(PaymentStatus), required: true },
    snapshot: {
      customerName: String,
      customerPhone: String,
      providerName: String,
      serviceName: String,
      bookingNumber: String,
      serviceDate: Date,
      addressSummary: String,
    },
    pdfUrl: String,
    pdfKey: String,
    pdfGeneratedAt: Date,
    pdfTemplateVersion: Number,
    issuedAt: Date,
    dueAt: Date,
    paidAt: Date,
  },
  { timestamps: true },
);

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
