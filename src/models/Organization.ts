import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  OrganizationBillingMode,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  OrganizationPaymentTerms,
  OrganizationPermission,
  OrganizationStatus,
  OrganizationType,
} from '@ghaarfix/shared-types';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  type: OrganizationType;
  status: OrganizationStatus;
  billingProfile: {
    billingMode: OrganizationBillingMode;
    paymentTerms: OrganizationPaymentTerms;
    creditLimit?: number;
    overdueThresholdDays?: number;
    currency: string;
  };
  settings: {
    requireBookingApproval?: boolean;
    approvalAmountThreshold?: number;
    allowUrgentBypass?: boolean;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: Object.values(OrganizationType), required: true },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      default: OrganizationStatus.ACTIVE,
      index: true,
    },
    billingProfile: {
      billingMode: {
        type: String,
        enum: Object.values(OrganizationBillingMode),
        default: OrganizationBillingMode.PER_BOOKING,
      },
      paymentTerms: {
        type: String,
        enum: Object.values(OrganizationPaymentTerms),
        default: OrganizationPaymentTerms.NET_30,
      },
      creditLimit: Number,
      overdueThresholdDays: { type: Number, default: 30 },
      currency: { type: String, default: 'INR' },
    },
    settings: {
      requireBookingApproval: { type: Boolean, default: false },
      approvalAmountThreshold: Number,
      allowUrgentBypass: { type: Boolean, default: true },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

organizationSchema.index({ status: 1, type: 1 });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);

export interface IOrganizationMember extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: OrganizationMemberRole;
  permissions: OrganizationPermission[];
  status: OrganizationMemberStatus;
  invitedAt?: Date;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const organizationMemberSchema = new Schema<IOrganizationMember>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: Object.values(OrganizationMemberRole), required: true },
    permissions: { type: [String], enum: Object.values(OrganizationPermission), default: [] },
    status: {
      type: String,
      enum: Object.values(OrganizationMemberStatus),
      default: OrganizationMemberStatus.INVITED,
      index: true,
    },
    invitedAt: Date,
    joinedAt: Date,
  },
  { timestamps: true },
);

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const OrganizationMember = mongoose.model<IOrganizationMember>(
  'OrganizationMember',
  organizationMemberSchema,
);

export interface IOrganizationAuditLog extends Document {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  timestamp: Date;
}

const organizationAuditSchema = new Schema<IOrganizationAuditLog>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  reason: String,
  timestamp: { type: Date, default: Date.now, index: true },
});

export const OrganizationAuditLog = mongoose.model<IOrganizationAuditLog>(
  'OrganizationAuditLog',
  organizationAuditSchema,
);
