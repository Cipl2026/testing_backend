import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  AlertSeverity,
  AlertStatus,
  BackupVerificationStatus,
  DlqJobStatus,
  IncidentSeverity,
  IncidentStatus,
  MaintenanceMode,
  SloStatus,
} from '@ghaarfix/shared-types';

export interface IOperationalAlert extends Document {
  source: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  status: AlertStatus;
  deduplicationKey: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IOperationalAlert>(
  {
    source: { type: String, required: true, index: true },
    severity: { type: String, enum: Object.values(AlertSeverity), required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metric: String,
    threshold: Number,
    currentValue: Number,
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      default: AlertStatus.OPEN,
      index: true,
    },
    deduplicationKey: { type: String, required: true, index: true },
    acknowledgedAt: Date,
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true },
);

alertSchema.index({ deduplicationKey: 1, status: 1 });
alertSchema.index({ createdAt: -1 });

export const OperationalAlert = mongoose.model<IOperationalAlert>(
  'OperationalAlert',
  alertSchema,
);

export interface IIncident extends Document {
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt?: Date;
  owner?: Types.ObjectId;
  impact?: string;
  affectedServices: string[];
  rootCause?: string;
  followUpActions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    title: { type: String, required: true },
    severity: { type: String, enum: Object.values(IncidentSeverity), required: true, index: true },
    status: {
      type: String,
      enum: Object.values(IncidentStatus),
      default: IncidentStatus.OPEN,
      index: true,
    },
    startedAt: { type: Date, required: true, index: true },
    resolvedAt: Date,
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    impact: String,
    affectedServices: { type: [String], default: [] },
    rootCause: String,
    followUpActions: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Incident = mongoose.model<IIncident>('Incident', incidentSchema);

export interface IIncidentTimelineEvent extends Document {
  incidentId: Types.ObjectId;
  message: string;
  actorId?: Types.ObjectId;
  createdAt: Date;
}

const timelineSchema = new Schema<IIncidentTimelineEvent>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    message: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const IncidentTimelineEvent = mongoose.model<IIncidentTimelineEvent>(
  'IncidentTimelineEvent',
  timelineSchema,
);

export interface IPostmortemAction extends Document {
  incidentId: Types.ObjectId;
  action: string;
  owner?: string;
  dueAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const postmortemSchema = new Schema<IPostmortemAction>(
  {
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
    action: { type: String, required: true },
    owner: String,
    dueAt: Date,
    completedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PostmortemAction = mongoose.model<IPostmortemAction>(
  'PostmortemAction',
  postmortemSchema,
);

export interface IServiceLevelObjective extends Document {
  key: string;
  name: string;
  service: string;
  metric: string;
  target: number;
  windowDays: number;
  severity: AlertSeverity;
  isLatency?: boolean;
  status: SloStatus;
  createdAt: Date;
  updatedAt: Date;
}

const sloSchema = new Schema<IServiceLevelObjective>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    service: { type: String, required: true },
    metric: { type: String, required: true },
    target: { type: Number, required: true },
    windowDays: { type: Number, default: 30 },
    severity: { type: String, enum: Object.values(AlertSeverity), default: AlertSeverity.WARNING },
    isLatency: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(SloStatus), default: SloStatus.HEALTHY },
  },
  { timestamps: true },
);

export const ServiceLevelObjective = mongoose.model<IServiceLevelObjective>(
  'ServiceLevelObjective',
  sloSchema,
);

export interface IServiceLevelSnapshot extends Document {
  sloId: Types.ObjectId;
  windowStart: Date;
  windowEnd: Date;
  actualValue: number;
  target: number;
  errorBudgetRemaining: number;
  burnRate: number;
  status: SloStatus;
  createdAt: Date;
}

const sloSnapshotSchema = new Schema<IServiceLevelSnapshot>(
  {
    sloId: { type: Schema.Types.ObjectId, ref: 'ServiceLevelObjective', required: true, index: true },
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true },
    actualValue: { type: Number, required: true },
    target: { type: Number, required: true },
    errorBudgetRemaining: { type: Number, default: 1 },
    burnRate: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(SloStatus), required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sloSnapshotSchema.index({ sloId: 1, windowStart: -1 });

export const ServiceLevelSnapshot = mongoose.model<IServiceLevelSnapshot>(
  'ServiceLevelSnapshot',
  sloSnapshotSchema,
);

export interface IBackupVerification extends Document {
  backupId: string;
  status: BackupVerificationStatus;
  restoreTestedAt?: Date;
  integrityResult?: string;
  verifiedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const backupSchema = new Schema<IBackupVerification>(
  {
    backupId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(BackupVerificationStatus),
      default: BackupVerificationStatus.PENDING,
      index: true,
    },
    restoreTestedAt: { type: Date, index: true },
    integrityResult: String,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true },
);

export const BackupVerification = mongoose.model<IBackupVerification>(
  'BackupVerification',
  backupSchema,
);

export interface IDeadLetterJob extends Document {
  queueName: string;
  jobId: string;
  jobName: string;
  payload: Record<string, unknown>;
  sanitizedPayload?: Record<string, unknown>;
  error: string;
  attempts: number;
  status: DlqJobStatus;
  traceContext?: { requestId?: string; traceId?: string };
  firstFailedAt: Date;
  lastFailedAt: Date;
  discardedAt?: Date;
  discardReason?: string;
  retriedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dlqSchema = new Schema<IDeadLetterJob>(
  {
    queueName: { type: String, required: true, index: true },
    jobId: { type: String, required: true, index: true },
    jobName: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    sanitizedPayload: { type: Schema.Types.Mixed },
    error: { type: String, required: true },
    attempts: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: Object.values(DlqJobStatus),
      default: DlqJobStatus.DEAD_LETTER,
      index: true,
    },
    traceContext: { type: Schema.Types.Mixed },
    firstFailedAt: { type: Date, default: Date.now },
    lastFailedAt: { type: Date, default: Date.now, index: true },
    discardedAt: Date,
    discardReason: String,
    retriedAt: Date,
  },
  { timestamps: true },
);

dlqSchema.index({ queueName: 1, jobId: 1 }, { unique: true });
dlqSchema.index({ status: 1, createdAt: -1 });

export const DeadLetterJob = mongoose.model<IDeadLetterJob>('DeadLetterJob', dlqSchema);

export interface IReleaseHealthSnapshot extends Document {
  releaseVersion: string;
  gitCommit?: string;
  environment: string;
  errorRate: number;
  p95LatencyMs: number;
  queueDepth: number;
  activeIncidents: number;
  openAlerts: number;
  createdAt: Date;
}

const releaseSchema = new Schema<IReleaseHealthSnapshot>(
  {
    releaseVersion: { type: String, required: true, index: true },
    gitCommit: String,
    environment: { type: String, required: true },
    errorRate: { type: Number, default: 0 },
    p95LatencyMs: { type: Number, default: 0 },
    queueDepth: { type: Number, default: 0 },
    activeIncidents: { type: Number, default: 0 },
    openAlerts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

releaseSchema.index({ releaseVersion: 1, createdAt: -1 });

export const ReleaseHealthSnapshot = mongoose.model<IReleaseHealthSnapshot>(
  'ReleaseHealthSnapshot',
  releaseSchema,
);

export interface IDisasterRecoveryPlan extends Document {
  key: string;
  title: string;
  failureScenario: string;
  rtoMinutes: number;
  rpoMinutes: number;
  recoveryProcedure: string;
  verificationSteps: string;
  owner?: string;
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const drSchema = new Schema<IDisasterRecoveryPlan>(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    failureScenario: { type: String, required: true },
    rtoMinutes: { type: Number, required: true },
    rpoMinutes: { type: Number, required: true },
    recoveryProcedure: { type: String, required: true },
    verificationSteps: { type: String, required: true },
    owner: String,
    lastTestedAt: Date,
  },
  { timestamps: true },
);

export const DisasterRecoveryPlan = mongoose.model<IDisasterRecoveryPlan>(
  'DisasterRecoveryPlan',
  drSchema,
);

export interface IMonitoredError extends Document {
  errorCode: string;
  message: string;
  normalizedStack?: string;
  releaseVersion?: string;
  environment: string;
  requestId?: string;
  traceId?: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  deduplicationKey: string;
}

const errorSchema = new Schema<IMonitoredError>(
  {
    errorCode: { type: String, required: true, index: true },
    message: { type: String, required: true },
    normalizedStack: String,
    releaseVersion: String,
    environment: { type: String, required: true },
    requestId: String,
    traceId: String,
    count: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    deduplicationKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: false },
);

export const MonitoredError = mongoose.model<IMonitoredError>('MonitoredError', errorSchema);

export interface IMaintenanceModeConfig extends Document {
  key: string;
  mode: MaintenanceMode;
  message?: string;
  updatedBy?: Types.ObjectId;
  updatedAt: Date;
}

const maintenanceSchema = new Schema<IMaintenanceModeConfig>(
  {
    key: { type: String, default: 'global', unique: true },
    mode: {
      type: String,
      enum: Object.values(MaintenanceMode),
      default: MaintenanceMode.NONE,
    },
    message: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const MaintenanceModeConfig = mongoose.model<IMaintenanceModeConfig>(
  'MaintenanceModeConfig',
  maintenanceSchema,
);
