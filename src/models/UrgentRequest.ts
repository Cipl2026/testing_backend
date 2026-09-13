import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  PaymentMethod,
  UrgentRequestStatus,
} from '@ghaarfix/shared-types';
import type { AddressSnapshot, HomeHelpBookingSnapshot } from '@/models/Booking.js';

export interface UrgentPricingSnapshot {
  baseAmount: number;
  urgentFee: number;
  jobSubtotal: number;
  platformFee: number;
  providerPayoutAmount: number;
  estimatedTotal: number;
  currency: string;
  pricingVersion: number;
}

export interface IUrgentRequest extends Document {
  requestNumber: string;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  customServiceName?: string;
  providerId?: Types.ObjectId;
  bookingId?: Types.ObjectId;
  addressSnapshot: AddressSnapshot;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  customerNotes?: string;
  status: UrgentRequestStatus;
  paymentMethod: PaymentMethod;
  pricing: UrgentPricingSnapshot;
  searchConfig: {
    maxDistanceKm: number;
    maxBroadcastProviders: number;
    broadcastCount: number;
    currentRadiusKm?: number;
    notifiedCount?: number;
    eligiblePoolSize?: number;
    waveIndex?: number;
  };
  acceptedAt?: Date;
  expiresAt: Date;
  cancelledAt?: Date;
  completedAt?: Date;
  cancellation?: {
    reason?: string;
    actorId?: Types.ObjectId;
    actorRole?: string;
  };
  homeHelp?: HomeHelpBookingSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const urgentRequestSchema = new Schema<IUrgentRequest>(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    customServiceName: { type: String, maxlength: 120 },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    addressSnapshot: {
      recipientName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      city: String,
      state: String,
      postalCode: String,
      location: { latitude: Number, longitude: Number },
    },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    customerNotes: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(UrgentRequestStatus),
      required: true,
      index: true,
    },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    pricing: {
      baseAmount: { type: Number, required: true },
      urgentFee: { type: Number, required: true },
      jobSubtotal: { type: Number },
      platformFee: { type: Number },
      providerPayoutAmount: { type: Number },
      estimatedTotal: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      pricingVersion: { type: Number, default: 2 },
    },
    searchConfig: {
      maxDistanceKm: Number,
      maxBroadcastProviders: Number,
      broadcastCount: { type: Number, default: 0 },
      currentRadiusKm: { type: Number, default: 1 },
      notifiedCount: { type: Number, default: 0 },
      eligiblePoolSize: { type: Number, default: 0 },
      waveIndex: { type: Number, default: 0 },
    },
    acceptedAt: Date,
    expiresAt: { type: Date, required: true, index: true },
    cancelledAt: Date,
    completedAt: Date,
    cancellation: {
      reason: String,
      actorId: Schema.Types.ObjectId,
      actorRole: String,
    },
    homeHelp: {
      durationPackageId: { type: Schema.Types.ObjectId, ref: 'HomeHelpDurationPackage' },
      durationLabel: String,
      durationMinutes: Number,
      quotedAmount: Number,
      generalNotes: String,
      tasks: [
        {
          serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
          name: String,
          priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'] },
          notes: String,
        },
      ],
    },
  },
  { timestamps: true },
);

urgentRequestSchema.index({ location: '2dsphere' });
urgentRequestSchema.index({ customerId: 1, status: 1 });

export const UrgentRequest = mongoose.model<IUrgentRequest>('UrgentRequest', urgentRequestSchema);
