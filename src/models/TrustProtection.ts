import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  ArrivalVerificationResult,
  ClaimResolutionType,
  DamageAssessmentStatus,
  GuaranteePolicyStatus,
  ImprovementPlanStatus,
  PartApprovalStatus,
  ProtectionClaimStatus,
  ProtectionClaimType,
  ProviderQualityScoreStatus,
  QualityChecklistStatus,
  QualityInspectionResult,
  QualityInspectionStatus,
  RevisitReason,
  ServiceCertificationLevel,
  ServiceCertificationStatus,
} from '@ghaarfix/shared-types';

export interface IServiceGuaranteePolicy extends Document {
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  version: number;
  coverageDays: number;
  coveredIssueTypes: string[];
  exclusions: string[];
  maxClaims: number;
  resolutionOptions: ClaimResolutionType[];
  status: GuaranteePolicyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const policySchema = new Schema<IServiceGuaranteePolicy>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    version: { type: Number, default: 1 },
    coverageDays: { type: Number, default: 30 },
    coveredIssueTypes: [String],
    exclusions: [String],
    maxClaims: { type: Number, default: 2 },
    resolutionOptions: [{ type: String, enum: Object.values(ClaimResolutionType) }],
    status: {
      type: String,
      enum: Object.values(GuaranteePolicyStatus),
      default: GuaranteePolicyStatus.DRAFT,
      index: true,
    },
  },
  { timestamps: true },
);

export const ServiceGuaranteePolicy = mongoose.model<IServiceGuaranteePolicy>(
  'ServiceGuaranteePolicy',
  policySchema,
);

export interface IGuaranteeSnapshot extends Document {
  bookingId: Types.ObjectId;
  policyId: Types.ObjectId;
  policyVersion: number;
  coverageDays: number;
  coveredIssueTypes: string[];
  exclusions: string[];
  maxClaims: number;
  resolutionOptions: ClaimResolutionType[];
  coverageEndsAt: Date;
  createdAt: Date;
}

const snapshotSchema = new Schema<IGuaranteeSnapshot>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'ServiceGuaranteePolicy', required: true },
    policyVersion: { type: Number, required: true },
    coverageDays: { type: Number, required: true },
    coveredIssueTypes: [String],
    exclusions: [String],
    maxClaims: { type: Number, required: true },
    resolutionOptions: [{ type: String }],
    coverageEndsAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const GuaranteeSnapshot = mongoose.model<IGuaranteeSnapshot>(
  'GuaranteeSnapshot',
  snapshotSchema,
);

export interface IServiceProtectionClaim extends Document {
  claimNumber: string;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId?: Types.ObjectId;
  type: ProtectionClaimType;
  description: string;
  evidence: Array<{ fileKey: string; fileUrl: string; mimeType: string; uploadedAt: Date }>;
  status: ProtectionClaimStatus;
  requestedResolution?: ClaimResolutionType;
  resolution?: ClaimResolutionType;
  resolutionNotes?: string;
  providerResponse?: string;
  internalNotes?: string;
  repeatIssueDetected?: boolean;
  idempotencyKey?: string;
  slaDueAt?: Date;
  resolvedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const claimSchema = new Schema<IServiceProtectionClaim>(
  {
    claimNumber: { type: String, required: true, unique: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: Object.values(ProtectionClaimType), required: true },
    description: { type: String, required: true },
    evidence: [
      {
        fileKey: String,
        fileUrl: String,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: Object.values(ProtectionClaimStatus),
      default: ProtectionClaimStatus.SUBMITTED,
      index: true,
    },
    requestedResolution: { type: String, enum: Object.values(ClaimResolutionType) },
    resolution: { type: String, enum: Object.values(ClaimResolutionType) },
    resolutionNotes: String,
    providerResponse: String,
    internalNotes: String,
    repeatIssueDetected: Boolean,
    idempotencyKey: { type: String, sparse: true, unique: true },
    slaDueAt: { type: Date, index: true },
    resolvedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
claimSchema.index({ status: 1, createdAt: -1 });

export const ServiceProtectionClaim = mongoose.model<IServiceProtectionClaim>(
  'ServiceProtectionClaim',
  claimSchema,
);

export interface IServiceArrivalEvidence extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  result: ArrivalVerificationResult;
  proximityMeters?: number;
  customerConfirmed: boolean;
  otpVerified: boolean;
  verifiedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
}

const arrivalSchema = new Schema<IServiceArrivalEvidence>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    result: { type: String, enum: Object.values(ArrivalVerificationResult), required: true },
    proximityMeters: Number,
    customerConfirmed: { type: Boolean, default: false },
    otpVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, required: true },
    expiresAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ServiceArrivalEvidence = mongoose.model<IServiceArrivalEvidence>(
  'ServiceArrivalEvidence',
  arrivalSchema,
);

export interface IServiceQualityChecklist extends Document {
  serviceId: Types.ObjectId;
  version: number;
  items: Array<{
    label: string;
    type: string;
    required: boolean;
    validation?: string;
  }>;
  requiredEvidence: string[];
  status: QualityChecklistStatus;
  createdAt: Date;
  updatedAt: Date;
}

const checklistSchema = new Schema<IServiceQualityChecklist>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    version: { type: Number, default: 1 },
    items: [
      {
        label: String,
        type: String,
        required: Boolean,
        validation: String,
      },
    ],
    requiredEvidence: [String],
    status: {
      type: String,
      enum: Object.values(QualityChecklistStatus),
      default: QualityChecklistStatus.ACTIVE,
    },
  },
  { timestamps: true },
);
checklistSchema.index({ serviceId: 1, version: 1 }, { unique: true });

export const ServiceQualityChecklist = mongoose.model<IServiceQualityChecklist>(
  'ServiceQualityChecklist',
  checklistSchema,
);

export interface IChecklistSnapshot extends Document {
  bookingId: Types.ObjectId;
  checklistId: Types.ObjectId;
  version: number;
  items: Array<{ label: string; type: string; required: boolean; completed: boolean; value?: string }>;
  completedAt?: Date;
  createdAt: Date;
}

const checklistSnapSchema = new Schema<IChecklistSnapshot>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    checklistId: { type: Schema.Types.ObjectId, ref: 'ServiceQualityChecklist', required: true },
    version: { type: Number, required: true },
    items: [
      { label: String, type: String, required: Boolean, completed: Boolean, value: String },
    ],
    completedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ChecklistSnapshot = mongoose.model<IChecklistSnapshot>(
  'ChecklistSnapshot',
  checklistSnapSchema,
);

export interface IPartApproval extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  customerId: Types.ObjectId;
  partName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
  warrantyDays?: number;
  status: PartApprovalStatus;
  evidenceFileKey?: string;
  expiresAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const partSchema = new Schema<IPartApproval>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    reason: { type: String, required: true },
    warrantyDays: Number,
    status: {
      type: String,
      enum: Object.values(PartApprovalStatus),
      default: PartApprovalStatus.PENDING,
      index: true,
    },
    evidenceFileKey: String,
    expiresAt: { type: Date, required: true, index: true },
    approvedAt: Date,
  },
  { timestamps: true },
);

export const PartApproval = mongoose.model<IPartApproval>('PartApproval', partSchema);

export interface IDamageAssessment extends Document {
  claimId: Types.ObjectId;
  bookingId: Types.ObjectId;
  description: string;
  customerEvidence: string[];
  providerResponse?: string;
  inspectionNotes?: string;
  status: DamageAssessmentStatus;
  resolution?: ClaimResolutionType;
  createdAt: Date;
  updatedAt: Date;
}

const damageSchema = new Schema<IDamageAssessment>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'ServiceProtectionClaim', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    description: { type: String, required: true },
    customerEvidence: [String],
    providerResponse: String,
    inspectionNotes: String,
    status: {
      type: String,
      enum: Object.values(DamageAssessmentStatus),
      default: DamageAssessmentStatus.PENDING,
    },
    resolution: { type: String, enum: Object.values(ClaimResolutionType) },
  },
  { timestamps: true },
);

export const DamageAssessment = mongoose.model<IDamageAssessment>('DamageAssessment', damageSchema);

export interface IQualityInspection extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  inspectorId?: Types.ObjectId;
  trigger: string;
  checklist: Array<{ label: string; passed: boolean; notes?: string }>;
  result?: QualityInspectionResult;
  evidence: string[];
  status: QualityInspectionStatus;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const inspectionSchema = new Schema<IQualityInspection>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inspectorId: { type: Schema.Types.ObjectId, ref: 'User' },
    trigger: { type: String, required: true },
    checklist: [{ label: String, passed: Boolean, notes: String }],
    result: { type: String, enum: Object.values(QualityInspectionResult) },
    evidence: [String],
    status: {
      type: String,
      enum: Object.values(QualityInspectionStatus),
      default: QualityInspectionStatus.SCHEDULED,
      index: true,
    },
    completedAt: Date,
  },
  { timestamps: true },
);

export const QualityInspection = mongoose.model<IQualityInspection>(
  'QualityInspection',
  inspectionSchema,
);

export interface IProviderQualityScore extends Document {
  providerId: Types.ObjectId;
  overallScore: number;
  reliabilityScore: number;
  qualityScore: number;
  complianceScore: number;
  customerProtectionScore: number;
  status: ProviderQualityScoreStatus;
  sampleSize: number;
  recommendedActions: string[];
  lastCalculatedAt: Date;
  updatedAt: Date;
}

const scoreSchema = new Schema<IProviderQualityScore>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    overallScore: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    complianceScore: { type: Number, default: 0 },
    customerProtectionScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ProviderQualityScoreStatus),
      default: ProviderQualityScoreStatus.GOOD,
      index: true,
    },
    sampleSize: { type: Number, default: 0 },
    recommendedActions: [String],
    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const ProviderQualityScore = mongoose.model<IProviderQualityScore>(
  'ProviderQualityScore',
  scoreSchema,
);

export interface IProviderQualityImprovementPlan extends Document {
  providerId: Types.ObjectId;
  issues: string[];
  actions: string[];
  deadline: Date;
  status: ImprovementPlanStatus;
  reviewNotes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IProviderQualityImprovementPlan>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    issues: [String],
    actions: [String],
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(ImprovementPlanStatus),
      default: ImprovementPlanStatus.ACTIVE,
      index: true,
    },
    reviewNotes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const ProviderQualityImprovementPlan = mongoose.model<IProviderQualityImprovementPlan>(
  'ProviderQualityImprovementPlan',
  planSchema,
);

export interface IProviderServiceCertification extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  level: ServiceCertificationLevel;
  verifiedAt?: Date;
  expiresAt?: Date;
  status: ServiceCertificationStatus;
  requirements: string[];
  createdAt: Date;
  updatedAt: Date;
}

const certSchema = new Schema<IProviderServiceCertification>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    level: { type: String, enum: Object.values(ServiceCertificationLevel), required: true },
    verifiedAt: Date,
    expiresAt: { type: Date, index: true },
    status: {
      type: String,
      enum: Object.values(ServiceCertificationStatus),
      default: ServiceCertificationStatus.PENDING,
      index: true,
    },
    requirements: [String],
  },
  { timestamps: true },
);
certSchema.index({ providerId: 1, serviceId: 1 }, { unique: true });

export const ProviderServiceCertification = mongoose.model<IProviderServiceCertification>(
  'ProviderServiceCertification',
  certSchema,
);

export interface IRevisitBookingContext extends Document {
  originalBookingId: Types.ObjectId;
  revisitBookingId?: Types.ObjectId;
  claimId?: Types.ObjectId;
  reason: RevisitReason;
  guaranteeSnapshotId?: Types.ObjectId;
  preferOriginalProvider: boolean;
  assignedOriginalProvider?: boolean;
  createdAt: Date;
}

const revisitSchema = new Schema<IRevisitBookingContext>(
  {
    originalBookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    revisitBookingId: { type: Schema.Types.ObjectId, ref: 'Booking', sparse: true, index: true },
    claimId: { type: Schema.Types.ObjectId, ref: 'ServiceProtectionClaim' },
    reason: { type: String, enum: Object.values(RevisitReason), required: true },
    guaranteeSnapshotId: { type: Schema.Types.ObjectId, ref: 'GuaranteeSnapshot' },
    preferOriginalProvider: { type: Boolean, default: true },
    assignedOriginalProvider: Boolean,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RevisitBookingContext = mongoose.model<IRevisitBookingContext>(
  'RevisitBookingContext',
  revisitSchema,
);

export interface IBookingRefund extends Document {
  bookingId: Types.ObjectId;
  claimId?: Types.ObjectId;
  amount: number;
  currency: string;
  idempotencyKey: string;
  providerRefundId?: string;
  status: string;
  processedBy?: Types.ObjectId;
  createdAt: Date;
}

const refundSchema = new Schema<IBookingRefund>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    claimId: { type: Schema.Types.ObjectId, ref: 'ServiceProtectionClaim' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    idempotencyKey: { type: String, required: true, unique: true },
    providerRefundId: String,
    status: { type: String, default: 'PENDING', index: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const BookingRefund = mongoose.model<IBookingRefund>('BookingRefund', refundSchema);
