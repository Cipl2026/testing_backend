import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ApprovalRequestStatus,
  ApprovalResourceType,
  ApprovalTriggerType,
  BulkBookingItemStatus,
  BulkBookingStatus,
  MaintenanceFrequency,
  OrganizationMaintenanceStatus,
  OrganizationBudgetPeriod,
  OrganizationInvoiceStatus,
  OrganizationPricingMode,
  SLAPriority,
  SLAStatus,
  WorkOrderStatus,
} from '@ghaarfix/shared-types';

export interface IApprovalPolicy extends Document {
  organizationId: Types.ObjectId;
  triggerType: ApprovalTriggerType;
  conditions: Record<string, unknown>;
  requiredApproverRoles: string[];
  rules?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const approvalPolicySchema = new Schema<IApprovalPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    triggerType: { type: String, enum: Object.values(ApprovalTriggerType), required: true },
    conditions: { type: Schema.Types.Mixed, default: {} },
    requiredApproverRoles: { type: [String], default: [] },
    rules: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ApprovalPolicy = mongoose.model<IApprovalPolicy>('ApprovalPolicy', approvalPolicySchema);

export interface IApprovalRequest extends Document {
  organizationId: Types.ObjectId;
  resourceType: ApprovalResourceType;
  resourceId: string;
  status: ApprovalRequestStatus;
  requestedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  resolvedAt?: Date;
}

const approvalRequestSchema = new Schema<IApprovalRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    resourceType: { type: String, enum: Object.values(ApprovalResourceType), required: true },
    resourceId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ApprovalRequestStatus),
      default: ApprovalRequestStatus.PENDING,
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    metadata: { type: Schema.Types.Mixed },
    resolvedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

approvalRequestSchema.index({ organizationId: 1, status: 1, resourceType: 1 });

export const ApprovalRequest = mongoose.model<IApprovalRequest>('ApprovalRequest', approvalRequestSchema);

export interface IBulkBookingRequest extends Document {
  organizationId: Types.ObjectId;
  templateId?: Types.ObjectId;
  serviceId: Types.ObjectId;
  properties: Array<{ propertyId: string; unitId?: string }>;
  scheduleStrategy: Record<string, unknown>;
  status: BulkBookingStatus;
  createdBy: Types.ObjectId;
  totals: {
    total: number;
    validated: number;
    created: number;
    failed: number;
  };
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bulkBookingSchema = new Schema<IBulkBookingRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'OrganizationBookingTemplate' },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    properties: [
      {
        propertyId: { type: String, required: true },
        unitId: String,
      },
    ],
    scheduleStrategy: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(BulkBookingStatus),
      default: BulkBookingStatus.DRAFT,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    totals: {
      total: { type: Number, default: 0 },
      validated: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

bulkBookingSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const BulkBookingRequest = mongoose.model<IBulkBookingRequest>(
  'BulkBookingRequest',
  bulkBookingSchema,
);

export interface IBulkBookingItem extends Document {
  bulkRequestId: Types.ObjectId;
  propertyId: Types.ObjectId;
  unitId?: Types.ObjectId;
  status: BulkBookingItemStatus;
  bookingId?: Types.ObjectId;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bulkItemSchema = new Schema<IBulkBookingItem>(
  {
    bulkRequestId: { type: Schema.Types.ObjectId, ref: 'BulkBookingRequest', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'PropertyUnit' },
    status: {
      type: String,
      enum: Object.values(BulkBookingItemStatus),
      default: BulkBookingItemStatus.PENDING,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    errorMessage: String,
  },
  { timestamps: true },
);

bulkItemSchema.index({ bulkRequestId: 1, propertyId: 1, unitId: 1 }, { unique: true });

export const BulkBookingItem = mongoose.model<IBulkBookingItem>('BulkBookingItem', bulkItemSchema);

export interface IOrganizationBookingTemplate extends Document {
  organizationId: Types.ObjectId;
  name: string;
  serviceId: Types.ObjectId;
  defaultScope: Record<string, unknown>;
  scheduleConfig: Record<string, unknown>;
  approvalPolicyId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<IOrganizationBookingTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    defaultScope: { type: Schema.Types.Mixed, default: {} },
    scheduleConfig: { type: Schema.Types.Mixed, default: {} },
    approvalPolicyId: { type: Schema.Types.ObjectId, ref: 'ApprovalPolicy' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const OrganizationBookingTemplate = mongoose.model<IOrganizationBookingTemplate>(
  'OrganizationBookingTemplate',
  templateSchema,
);

export interface IOrganizationMaintenanceSchedule extends Document {
  organizationId: Types.ObjectId;
  propertyId: Types.ObjectId;
  assetId?: Types.ObjectId;
  serviceId: Types.ObjectId;
  frequency: MaintenanceFrequency;
  nextDueAt: Date;
  status: OrganizationMaintenanceStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const orgMaintenanceSchema = new Schema<IOrganizationMaintenanceSchedule>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset' },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    frequency: { type: String, enum: Object.values(MaintenanceFrequency), required: true },
    nextDueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(OrganizationMaintenanceStatus),
      default: OrganizationMaintenanceStatus.ACTIVE,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const OrganizationMaintenanceSchedule = mongoose.model<IOrganizationMaintenanceSchedule>(
  'OrganizationMaintenanceSchedule',
  orgMaintenanceSchema,
);

export interface IServiceLevelAgreement extends Document {
  organizationId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  priority: SLAPriority;
  responseTargetMinutes: number;
  completionTargetMinutes: number;
  businessHours?: Record<string, unknown>;
  penaltyRules?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const slaSchema = new Schema<IServiceLevelAgreement>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    priority: { type: String, enum: Object.values(SLAPriority), default: SLAPriority.NORMAL },
    responseTargetMinutes: { type: Number, required: true },
    completionTargetMinutes: { type: Number, required: true },
    businessHours: { type: Schema.Types.Mixed },
    penaltyRules: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

slaSchema.index({ organizationId: 1, serviceId: 1, priority: 1 });

export const ServiceLevelAgreement = mongoose.model<IServiceLevelAgreement>(
  'ServiceLevelAgreement',
  slaSchema,
);

export interface ISLATracker extends Document {
  organizationId: Types.ObjectId;
  bookingId: Types.ObjectId;
  slaId?: Types.ObjectId;
  status: SLAStatus;
  responseTargetAt?: Date;
  completionTargetAt?: Date;
  providerAssignedAt?: Date;
  providerAcceptedAt?: Date;
  providerArrivedAt?: Date;
  completedAt?: Date;
  breachReason?: string;
  exclusionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const slaTrackerSchema = new Schema<ISLATracker>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    slaId: { type: Schema.Types.ObjectId, ref: 'ServiceLevelAgreement' },
    status: {
      type: String,
      enum: Object.values(SLAStatus),
      default: SLAStatus.ON_TRACK,
      index: true,
    },
    responseTargetAt: Date,
    completionTargetAt: Date,
    providerAssignedAt: Date,
    providerAcceptedAt: Date,
    providerArrivedAt: Date,
    completedAt: Date,
    breachReason: String,
    exclusionReason: String,
  },
  { timestamps: true },
);

export const SLATracker = mongoose.model<ISLATracker>('SLATracker', slaTrackerSchema);

export interface IOrganizationPricingRule extends Document {
  organizationId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  pricingMode: OrganizationPricingMode;
  value: number;
  validFrom: Date;
  validTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pricingRuleSchema = new Schema<IOrganizationPricingRule>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    pricingMode: { type: String, enum: Object.values(OrganizationPricingMode), required: true },
    value: { type: Number, required: true },
    validFrom: { type: Date, required: true },
    validTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const OrganizationPricingRule = mongoose.model<IOrganizationPricingRule>(
  'OrganizationPricingRule',
  pricingRuleSchema,
);

export interface IOrganizationBudget extends Document {
  organizationId: Types.ObjectId;
  propertyId?: Types.ObjectId;
  period: OrganizationBudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  totalBudget: number;
  usedBudget: number;
  reservedBudget: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IOrganizationBudget>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', sparse: true, index: true },
    period: { type: String, enum: Object.values(OrganizationBudgetPeriod), required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalBudget: { type: Number, required: true, min: 0 },
    usedBudget: { type: Number, default: 0 },
    reservedBudget: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true },
);

budgetSchema.index({ organizationId: 1, propertyId: 1, periodStart: 1 });

export const OrganizationBudget = mongoose.model<IOrganizationBudget>('OrganizationBudget', budgetSchema);

export interface IOrganizationInvoice extends Document {
  organizationId: Types.ObjectId;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  status: OrganizationInvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueAt: Date;
  paidAt?: Date;
  lineItems: Array<{
    description: string;
    bookingId?: Types.ObjectId;
    amount: number;
  }>;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orgInvoiceSchema = new Schema<IOrganizationInvoice>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(OrganizationInvoiceStatus),
      default: OrganizationInvoiceStatus.DRAFT,
      index: true,
    },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    dueAt: { type: Date, required: true },
    paidAt: Date,
    lineItems: [
      {
        description: String,
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        amount: Number,
      },
    ],
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

orgInvoiceSchema.index({ organizationId: 1, periodStart: 1 });

export const OrganizationInvoice = mongoose.model<IOrganizationInvoice>(
  'OrganizationInvoice',
  orgInvoiceSchema,
);

export interface IWorkOrder extends Document {
  bookingId: Types.ObjectId;
  organizationId: Types.ObjectId;
  propertyId: Types.ObjectId;
  unitId?: Types.ObjectId;
  instructions?: string;
  checklist: string[];
  status: WorkOrderStatus;
  assignedProviderId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const workOrderSchema = new Schema<IWorkOrder>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'PropertyUnit' },
    instructions: String,
    checklist: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(WorkOrderStatus),
      default: WorkOrderStatus.OPEN,
      index: true,
    },
    assignedProviderId: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const WorkOrder = mongoose.model<IWorkOrder>('WorkOrder', workOrderSchema);
