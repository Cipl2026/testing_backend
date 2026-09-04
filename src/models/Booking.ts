import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  BookingStatus,
  BookingSource,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  ProviderRequestStatus,
  TrackingState,
  type AssetSnapshot,
  BookingContextType,
} from '@ghaarfix/shared-types';

export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  location?: { latitude: number; longitude: number };
}

export interface ServiceSnapshot {
  name: string;
  shortDescription?: string;
  pricing: { type: string; startingPrice?: number; currency: string };
}

export interface ProviderSnapshot {
  fullName: string;
  profileImage?: string;
  experienceYears?: number;
}

export interface ServiceZoneSnapshot {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  cityId: string;
  cityName: string;
}

export interface IBooking extends Document {
  bookingNumber: string;
  bookingType: BookingType;
  source: BookingSource;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  providerServiceId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  urgentRequestId?: Types.ObjectId;
  homeId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  bookingContextType: BookingContextType;
  organizationId?: Types.ObjectId;
  managedPropertyId?: Types.ObjectId;
  propertyUnitId?: Types.ObjectId;
  workOrderId?: Types.ObjectId;
  addressSnapshot: AddressSnapshot;
  assetSnapshot?: AssetSnapshot;
  serviceZoneId?: Types.ObjectId;
  serviceZoneSnapshot?: ServiceZoneSnapshot;
  serviceSnapshot: ServiceSnapshot;
  providerSnapshot: ProviderSnapshot;
  status: BookingStatus;
  providerRequestStatus: ProviderRequestStatus;
  providerResponseExpiresAt?: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  timezone: string;
  durationMinutes: number;
  customerNotes?: string;
  providerNotes?: string;
  price: {
    estimatedAmount: number;
    finalAmount: number;
    currency: string;
    visitCharge?: number;
    urgentSurcharge?: number;
    platformFeeAmount?: number;
    jobSubtotal?: number;
    customerJobSubtotal?: number;
    baseAmount?: number;
    subscriptionBenefitAmount?: number;
    promotionDiscount?: number;
    rewardCredit?: number;
    providerPayoutAmount?: number;
    entitlementId?: Types.ObjectId;
    carePlanBenefitLabel?: string;
  };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paymentId?: Types.ObjectId;
  };
  reschedule: {
    providerRescheduleCount: number;
  };
  cancellation?: {
    reason?: string;
    actorId?: Types.ObjectId;
    actorRole?: string;
    cancelledAt?: Date;
  };
  tracking?: {
    state: TrackingState;
    currentLocation?: { type: 'Point'; coordinates: [number, number] };
    locationUpdatedAt?: Date;
    completionConfirmedAt?: Date;
    serviceCompletionOtp?: string;
    serviceCompletionOtpExpiresAt?: Date;
    serviceCompletionOtpIssuedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const snapshotAddressSchema = new Schema<AddressSnapshot>(
  {
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
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    bookingType: {
      type: String,
      enum: Object.values(BookingType),
      default: BookingType.SCHEDULED,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(BookingSource),
      default: BookingSource.SLOT_RESERVATION,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    providerServiceId: { type: Schema.Types.ObjectId, ref: 'ProviderService', required: true },
    reservationId: { type: Schema.Types.ObjectId, ref: 'SlotReservation', sparse: true, unique: true },
    urgentRequestId: { type: Schema.Types.ObjectId, ref: 'UrgentRequest', sparse: true, unique: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', sparse: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset', sparse: true, index: true },
    bookingContextType: {
      type: String,
      enum: Object.values(BookingContextType),
      default: BookingContextType.PERSONAL,
      index: true,
    },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', sparse: true, index: true },
    managedPropertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', sparse: true, index: true },
    propertyUnitId: { type: Schema.Types.ObjectId, ref: 'PropertyUnit', sparse: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', sparse: true },
    addressSnapshot: { type: snapshotAddressSchema, required: true },
    assetSnapshot: {
      name: String,
      assetTypeName: String,
      brand: String,
      model: String,
      serialNumber: String,
      roomName: String,
    },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', sparse: true, index: true },
    serviceZoneSnapshot: {
      zoneId: String,
      zoneName: String,
      zoneType: String,
      cityId: String,
      cityName: String,
    },
    serviceSnapshot: {
      name: String,
      shortDescription: String,
      pricing: { type: { type: String }, startingPrice: Number, currency: String },
    },
    providerSnapshot: {
      fullName: String,
      profileImage: String,
      experienceYears: Number,
    },
    status: { type: String, enum: Object.values(BookingStatus), required: true, index: true },
    providerRequestStatus: {
      type: String,
      enum: Object.values(ProviderRequestStatus),
      required: true,
      index: true,
    },
    providerResponseExpiresAt: { type: Date, index: true },
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    timezone: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    customerNotes: { type: String, maxlength: 500 },
    providerNotes: { type: String, maxlength: 500 },
    price: {
      estimatedAmount: { type: Number, required: true },
      finalAmount: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      visitCharge: Number,
      urgentSurcharge: Number,
      platformFeeAmount: Number,
      jobSubtotal: Number,
      customerJobSubtotal: Number,
      baseAmount: Number,
      subscriptionBenefitAmount: Number,
      promotionDiscount: Number,
      rewardCredit: Number,
      providerPayoutAmount: Number,
      entitlementId: { type: Schema.Types.ObjectId, ref: 'Entitlement', sparse: true },
      carePlanBenefitLabel: String,
    },
    payment: {
      method: { type: String, enum: Object.values(PaymentMethod), required: true },
      status: { type: String, enum: Object.values(PaymentStatus), required: true, index: true },
      paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    },
    reschedule: {
      providerRescheduleCount: { type: Number, default: 0 },
    },
    cancellation: {
      reason: String,
      actorId: Schema.Types.ObjectId,
      actorRole: String,
      cancelledAt: Date,
    },
    tracking: {
      state: {
        type: String,
        enum: Object.values(TrackingState),
        default: TrackingState.NOT_TRACKING,
      },
      currentLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number],
      },
      locationUpdatedAt: Date,
      completionConfirmedAt: Date,
      serviceCompletionOtp: { type: String, select: false },
      serviceCompletionOtpExpiresAt: Date,
      serviceCompletionOtpIssuedAt: Date,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ customerId: 1, scheduledStart: -1 });
bookingSchema.index({ providerId: 1, scheduledStart: -1 });
bookingSchema.index({ providerId: 1, scheduledStart: 1, scheduledEnd: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
