import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  AccountDeletionStatus,
  ConsentStatus,
  ConsentType,
  DataClassification,
  DataExportStatus,
  RetentionAction,
  SecurityEventSeverity,
  SecurityEventStatus,
  SecurityEventType,
  SecurityFindingSeverity,
  SecurityFindingStatus,
  StepUpMethod,
  StepUpStatus,
  ThreatRisk,
  ThreatStatus,
  UserRole,
} from '@ghaarfix/shared-types';

export interface ISession extends Document {
  userId: Types.ObjectId;
  userType: UserRole;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  ipHash?: string;
  userAgentHash?: string;
  refreshFamilyId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokeReason?: string;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userType: { type: String, enum: Object.values(UserRole), required: true },
    deviceId: String,
    deviceName: String,
    platform: String,
    appVersion: String,
    ipHash: String,
    userAgentHash: String,
    refreshFamilyId: { type: String, required: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, index: true },
    revokeReason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ userId: 1, expiresAt: 1 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

export const Session = mongoose.model<ISession>('Session', sessionSchema);

export interface IStepUpAuthentication extends Document {
  userId: Types.ObjectId;
  action: string;
  method: StepUpMethod;
  status: StepUpStatus;
  expiresAt: Date;
  verifiedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const stepUpSchema = new Schema<IStepUpAuthentication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    method: { type: String, enum: Object.values(StepUpMethod), required: true },
    status: { type: String, enum: Object.values(StepUpStatus), default: StepUpStatus.PENDING },
    expiresAt: { type: Date, required: true, index: true },
    verifiedAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const StepUpAuthentication = mongoose.model<IStepUpAuthentication>(
  'StepUpAuthentication',
  stepUpSchema,
);

export interface ISecurityEvent extends Document {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  actorId?: Types.ObjectId;
  targetId?: Types.ObjectId;
  actorType?: string;
  sourceIpHash?: string;
  sessionId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  status: SecurityEventStatus;
  createdAt: Date;
}

const securityEventSchema = new Schema<ISecurityEvent>(
  {
    type: { type: String, enum: Object.values(SecurityEventType), required: true, index: true },
    severity: { type: String, enum: Object.values(SecurityEventSeverity), required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    targetId: { type: Schema.Types.ObjectId, index: true },
    actorType: String,
    sourceIpHash: String,
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    metadata: Schema.Types.Mixed,
    status: {
      type: String,
      enum: Object.values(SecurityEventStatus),
      default: SecurityEventStatus.OPEN,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

securityEventSchema.index({ createdAt: -1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>('SecurityEvent', securityEventSchema);

export interface ISecurityAuditLog extends Document {
  actorId?: Types.ObjectId;
  actorType: string;
  action: string;
  targetType?: string;
  targetId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  sessionId?: Types.ObjectId;
  createdAt: Date;
}

const securityAuditSchema = new Schema<ISecurityAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorType: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: { type: Schema.Types.ObjectId, index: true },
    metadata: Schema.Types.Mixed,
    ipHash: String,
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

securityAuditSchema.index({ createdAt: -1 });

export const SecurityAuditLog = mongoose.model<ISecurityAuditLog>(
  'SecurityAuditLog',
  securityAuditSchema,
);

export interface ISecurityFinding extends Document {
  source: string;
  severity: SecurityFindingSeverity;
  title: string;
  component: string;
  affectedVersion?: string;
  status: SecurityFindingStatus;
  owner?: string;
  discoveredAt: Date;
  resolvedAt?: Date;
  description?: string;
}

const findingSchema = new Schema<ISecurityFinding>(
  {
    source: { type: String, required: true },
    severity: { type: String, enum: Object.values(SecurityFindingSeverity), required: true, index: true },
    title: { type: String, required: true },
    component: { type: String, required: true },
    affectedVersion: String,
    status: {
      type: String,
      enum: Object.values(SecurityFindingStatus),
      default: SecurityFindingStatus.OPEN,
      index: true,
    },
    owner: String,
    discoveredAt: { type: Date, default: Date.now, index: true },
    resolvedAt: Date,
    description: String,
  },
  { timestamps: true },
);

export const SecurityFinding = mongoose.model<ISecurityFinding>('SecurityFinding', findingSchema);

export interface IDataAsset extends Document {
  name: string;
  location: string;
  classification: DataClassification;
  owner?: string;
  retentionDays?: number;
  purpose: string;
  accessRoles: string[];
  createdAt: Date;
  updatedAt: Date;
}

const dataAssetSchema = new Schema<IDataAsset>(
  {
    name: { type: String, required: true, unique: true, index: true },
    location: { type: String, required: true },
    classification: { type: String, enum: Object.values(DataClassification), required: true },
    owner: String,
    retentionDays: Number,
    purpose: { type: String, required: true },
    accessRoles: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const DataAsset = mongoose.model<IDataAsset>('DataAsset', dataAssetSchema);

export interface IPrivacyConsentRecord extends Document {
  userId: Types.ObjectId;
  consentType: ConsentType;
  purpose: string;
  version: string;
  status: ConsentStatus;
  source: string;
  grantedAt?: Date;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const privacyConsentSchema = new Schema<IPrivacyConsentRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    consentType: { type: String, enum: Object.values(ConsentType), required: true },
    purpose: { type: String, required: true },
    version: { type: String, required: true, default: '1.0' },
    status: { type: String, enum: Object.values(ConsentStatus), required: true },
    source: { type: String, default: 'app' },
    grantedAt: Date,
    withdrawnAt: Date,
  },
  { timestamps: true },
);

privacyConsentSchema.index({ userId: 1, consentType: 1 }, { unique: true });

export const PrivacyConsentRecord = mongoose.model<IPrivacyConsentRecord>(
  'PrivacyConsentRecord',
  privacyConsentSchema,
);

export interface IDataExportRequest extends Document {
  userId: Types.ObjectId;
  status: DataExportStatus;
  downloadToken?: string;
  filePath?: string;
  expiresAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const exportSchema = new Schema<IDataExportRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: Object.values(DataExportStatus), default: DataExportStatus.PENDING, index: true },
    downloadToken: { type: String, unique: true, sparse: true },
    filePath: String,
    expiresAt: { type: Date, index: true },
    completedAt: Date,
    errorMessage: String,
  },
  { timestamps: true },
);

export const DataExportRequest = mongoose.model<IDataExportRequest>(
  'DataExportRequest',
  exportSchema,
);

export interface IAccountDeletionRequest extends Document {
  userId: Types.ObjectId;
  status: AccountDeletionStatus;
  reason?: string;
  scheduledFor?: Date;
  completedAt?: Date;
  retainedDataTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const deletionSchema = new Schema<IAccountDeletionRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(AccountDeletionStatus),
      default: AccountDeletionStatus.REQUESTED,
      index: true,
    },
    reason: String,
    scheduledFor: Date,
    completedAt: Date,
    retainedDataTypes: { type: [String], default: ['financial_ledger', 'booking_records'] },
  },
  { timestamps: true },
);

deletionSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['REQUESTED', 'PENDING_VERIFICATION', 'SCHEDULED', 'PROCESSING'] },
    },
  },
);

export const AccountDeletionRequest = mongoose.model<IAccountDeletionRequest>(
  'AccountDeletionRequest',
  deletionSchema,
);

export interface IDataRetentionPolicy extends Document {
  dataType: string;
  retentionDays: number;
  actionAfterExpiry: RetentionAction;
  legalBasis: string;
  exceptions?: string;
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
}

const retentionSchema = new Schema<IDataRetentionPolicy>(
  {
    dataType: { type: String, required: true, unique: true, index: true },
    retentionDays: { type: Number, required: true },
    actionAfterExpiry: { type: String, enum: Object.values(RetentionAction), required: true },
    legalBasis: { type: String, required: true },
    exceptions: String,
    owner: String,
  },
  { timestamps: true },
);

export const DataRetentionPolicy = mongoose.model<IDataRetentionPolicy>(
  'DataRetentionPolicy',
  retentionSchema,
);

export interface IThreatModel extends Document {
  asset: string;
  threat: string;
  attackVector: string;
  impact: string;
  likelihood: string;
  risk: ThreatRisk;
  mitigation: string;
  status: ThreatStatus;
  owner?: string;
  lastReviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const threatSchema = new Schema<IThreatModel>(
  {
    asset: { type: String, required: true, index: true },
    threat: { type: String, required: true },
    attackVector: { type: String, required: true },
    impact: { type: String, required: true },
    likelihood: { type: String, required: true },
    risk: { type: String, enum: Object.values(ThreatRisk), required: true, index: true },
    mitigation: { type: String, required: true },
    status: { type: String, enum: Object.values(ThreatStatus), default: ThreatStatus.OPEN, index: true },
    owner: String,
    lastReviewedAt: Date,
  },
  { timestamps: true },
);

export const ThreatModel = mongoose.model<IThreatModel>('ThreatModel', threatSchema);

export interface ISecurityRole extends Document {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<ISecurityRole>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: String,
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const SecurityRole = mongoose.model<ISecurityRole>('SecurityRole', roleSchema);

export interface ISecurityPermission extends Document {
  key: string;
  name: string;
  description?: string;
  category: string;
}

const permissionSchema = new Schema<ISecurityPermission>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: String,
    category: { type: String, required: true },
  },
  { timestamps: false },
);

export const SecurityPermission = mongoose.model<ISecurityPermission>(
  'SecurityPermission',
  permissionSchema,
);

export interface IOrganizationSecurityPolicy extends Document {
  organizationId: Types.ObjectId;
  requireMfaForAdmins: boolean;
  sessionTimeoutMinutes: number;
  allowedDomains: string[];
  updatedAt: Date;
}

const orgSecuritySchema = new Schema<IOrganizationSecurityPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    requireMfaForAdmins: { type: Boolean, default: false },
    sessionTimeoutMinutes: { type: Number, default: 480 },
    allowedDomains: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const OrganizationSecurityPolicy = mongoose.model<IOrganizationSecurityPolicy>(
  'OrganizationSecurityPolicy',
  orgSecuritySchema,
);

export interface IAdminMfaConfig extends Document {
  userId: Types.ObjectId;
  enabled: boolean;
  method?: string;
  secretRef?: string;
  backupCodesHash?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const mfaSchema = new Schema<IAdminMfaConfig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    enabled: { type: Boolean, default: false },
    method: String,
    secretRef: String,
    backupCodesHash: [String],
  },
  { timestamps: true },
);

export const AdminMfaConfig = mongoose.model<IAdminMfaConfig>('AdminMfaConfig', mfaSchema);
