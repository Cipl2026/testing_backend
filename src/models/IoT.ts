import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  AlertFeedbackType,
  ConnectedDeviceStatus,
  ConnectedDeviceType,
  DeviceAssetLinkRelationship,
  DeviceDiscoveryStatus,
  DeviceHealthLevel,
  HomeAlertSeverity,
  HomeAlertSource,
  HomeAlertStatus,
  IoTConnectionStatus,
  IoTEventSeverity,
  IoTEventStatus,
  IoTProviderType,
  IoTRuleActionType,
  IoTRuleScope,
  type IoTRuleAction,
  type IoTRuleCondition,
} from '@ghaarfix/shared-types';

export interface IIoTIntegrationConnection extends Document {
  customerId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  homeId?: Types.ObjectId;
  provider: IoTProviderType;
  status: IoTConnectionStatus;
  externalAccountId?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
  lastSyncAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IIoTIntegrationConnection>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', index: true },
    provider: { type: String, enum: Object.values(IoTProviderType), required: true },
    status: {
      type: String,
      enum: Object.values(IoTConnectionStatus),
      default: IoTConnectionStatus.PENDING,
      index: true,
    },
    externalAccountId: String,
    webhookSecret: String,
    metadata: Schema.Types.Mixed,
    lastSyncAt: Date,
    lastError: String,
  },
  { timestamps: true },
);

export const IoTIntegrationConnection = mongoose.model<IIoTIntegrationConnection>(
  'IoTIntegrationConnection',
  connectionSchema,
);

export interface IConnectedDevice extends Omit<Document, 'model'> {
  homeId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  managedPropertyId?: Types.ObjectId;
  propertyUnitId?: Types.ObjectId;
  connectionId?: Types.ObjectId;
  customerId: Types.ObjectId;
  provider: IoTProviderType;
  externalDeviceId: string;
  deviceType: ConnectedDeviceType;
  manufacturer?: string;
  model?: string;
  name: string;
  status: ConnectedDeviceStatus;
  discoveryStatus: DeviceDiscoveryStatus;
  capabilities: string[];
  lastSeenAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IConnectedDevice>(
  {
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    managedPropertyId: { type: Schema.Types.ObjectId, ref: 'ManagedProperty', index: true },
    propertyUnitId: { type: Schema.Types.ObjectId, ref: 'PropertyUnit' },
    connectionId: { type: Schema.Types.ObjectId, ref: 'IoTIntegrationConnection' },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: Object.values(IoTProviderType), required: true },
    externalDeviceId: { type: String, required: true },
    deviceType: { type: String, enum: Object.values(ConnectedDeviceType), required: true },
    manufacturer: String,
    model: String,
    name: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ConnectedDeviceStatus),
      default: ConnectedDeviceStatus.UNKNOWN,
      index: true,
    },
    discoveryStatus: {
      type: String,
      enum: Object.values(DeviceDiscoveryStatus),
      default: DeviceDiscoveryStatus.DISCOVERED,
    },
    capabilities: [String],
    lastSeenAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);
deviceSchema.index({ provider: 1, externalDeviceId: 1 }, { unique: true });

export const ConnectedDevice = mongoose.model<IConnectedDevice>('ConnectedDevice', deviceSchema);

export interface IDeviceAssetLink extends Document {
  connectedDeviceId: Types.ObjectId;
  assetId: Types.ObjectId;
  relationshipType: DeviceAssetLinkRelationship;
  confidence: number;
  verifiedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const linkSchema = new Schema<IDeviceAssetLink>(
  {
    connectedDeviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true, index: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset', required: true, index: true },
    relationshipType: {
      type: String,
      enum: Object.values(DeviceAssetLinkRelationship),
      required: true,
    },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
linkSchema.index({ connectedDeviceId: 1, assetId: 1 }, { unique: true });

export const DeviceAssetLink = mongoose.model<IDeviceAssetLink>('DeviceAssetLink', linkSchema);

export interface IIoTEvent extends Document {
  deviceId: Types.ObjectId;
  homeId?: Types.ObjectId;
  eventType: string;
  severity: IoTEventSeverity;
  payload: Record<string, unknown>;
  occurredAt: Date;
  receivedAt: Date;
  dedupeKey: string;
  status: IoTEventStatus;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IIoTEvent>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', index: true },
    eventType: { type: String, required: true, index: true },
    severity: { type: String, enum: Object.values(IoTEventSeverity), required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, index: true },
    receivedAt: { type: Date, default: Date.now },
    dedupeKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: Object.values(IoTEventStatus),
      default: IoTEventStatus.NEW,
      index: true,
    },
  },
  { timestamps: true },
);
eventSchema.index({ deviceId: 1, occurredAt: -1 });

export const IoTEvent = mongoose.model<IIoTEvent>('IoTEvent', eventSchema);

export interface IIoTRule extends Document {
  scope: IoTRuleScope;
  homeId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  name: string;
  description?: string;
  conditions: IoTRuleCondition;
  actions: IoTRuleAction[];
  priority: number;
  enabled: boolean;
  templateId?: Types.ObjectId;
  templateVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ruleSchema = new Schema<IIoTRule>(
  {
    scope: { type: String, enum: Object.values(IoTRuleScope), required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    name: { type: String, required: true },
    description: String,
    conditions: { type: Schema.Types.Mixed, required: true },
    actions: [{ type: { type: String, enum: Object.values(IoTRuleActionType) }, config: Schema.Types.Mixed }],
    priority: { type: Number, default: 100 },
    enabled: { type: Boolean, default: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'IoTRuleTemplate' },
    templateVersion: Number,
  },
  { timestamps: true },
);
ruleSchema.index({ scope: 1, enabled: 1 });

export const IoTRule = mongoose.model<IIoTRule>('IoTRule', ruleSchema);

export interface IIoTRuleTemplate extends Document {
  name: string;
  description?: string;
  conditions: IoTRuleCondition;
  actions: IoTRuleAction[];
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<IIoTRuleTemplate>(
  {
    name: { type: String, required: true },
    description: String,
    conditions: { type: Schema.Types.Mixed, required: true },
    actions: [{ type: { type: String, enum: Object.values(IoTRuleActionType) }, config: Schema.Types.Mixed }],
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'], default: 'DRAFT' },
  },
  { timestamps: true },
);

export const IoTRuleTemplate = mongoose.model<IIoTRuleTemplate>('IoTRuleTemplate', templateSchema);

export interface IDeviceHealthStatus extends Document {
  deviceId: Types.ObjectId;
  connectivityScore: number;
  dataFreshness?: Date;
  batteryStatus?: string;
  lastError?: string;
  healthStatus: DeviceHealthLevel;
  updatedAt: Date;
}

const healthSchema = new Schema<IDeviceHealthStatus>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true, unique: true },
    connectivityScore: { type: Number, default: 100, min: 0, max: 100 },
    dataFreshness: Date,
    batteryStatus: String,
    lastError: String,
    healthStatus: {
      type: String,
      enum: Object.values(DeviceHealthLevel),
      default: DeviceHealthLevel.UNKNOWN,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const DeviceHealthStatus = mongoose.model<IDeviceHealthStatus>(
  'DeviceHealthStatus',
  healthSchema,
);

export interface IHomeAlert extends Document {
  source: HomeAlertSource;
  sourceId?: Types.ObjectId;
  homeId: Types.ObjectId;
  organizationId?: Types.ObjectId;
  deviceId?: Types.ObjectId;
  severity: HomeAlertSeverity;
  title: string;
  message: string;
  recommendedActions: string[];
  safetyDisclaimer?: string;
  status: HomeAlertStatus;
  dedupeKey?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  feedback?: AlertFeedbackType;
  escalationSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IHomeAlert>(
  {
    source: { type: String, enum: Object.values(HomeAlertSource), required: true },
    sourceId: { type: Schema.Types.ObjectId },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice' },
    severity: { type: String, enum: Object.values(HomeAlertSeverity), required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    recommendedActions: [String],
    safetyDisclaimer: String,
    status: {
      type: String,
      enum: Object.values(HomeAlertStatus),
      default: HomeAlertStatus.ACTIVE,
      index: true,
    },
    dedupeKey: { type: String, sparse: true, unique: true },
    acknowledgedAt: Date,
    resolvedAt: Date,
    feedback: { type: String, enum: Object.values(AlertFeedbackType) },
    escalationSentAt: Date,
  },
  { timestamps: true },
);
alertSchema.index({ homeId: 1, status: 1 });
alertSchema.index({ severity: 1, createdAt: -1 });

export const HomeAlert = mongoose.model<IHomeAlert>('HomeAlert', alertSchema);

export interface IServiceSignalAccess extends Document {
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  deviceId?: Types.ObjectId;
  eventId?: Types.ObjectId;
  signalSummary: string;
  expiresAt: Date;
  createdAt: Date;
}

const signalAccessSchema = new Schema<IServiceSignalAccess>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice' },
    eventId: { type: Schema.Types.ObjectId, ref: 'IoTEvent' },
    signalSummary: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ServiceSignalAccess = mongoose.model<IServiceSignalAccess>(
  'ServiceSignalAccess',
  signalAccessSchema,
);

export interface ITelemetryPoint extends Document {
  deviceId: Types.ObjectId;
  metric: string;
  value: number;
  unit?: string;
  timestamp: Date;
}

const telemetrySchema = new Schema<ITelemetryPoint>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true },
    metric: { type: String, required: true },
    value: { type: Number, required: true },
    unit: String,
    timestamp: { type: Date, required: true },
  },
  { timestamps: false },
);
telemetrySchema.index({ deviceId: 1, metric: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const TelemetryPoint = mongoose.model<ITelemetryPoint>('TelemetryPoint', telemetrySchema);

export interface ITelemetryHourlyAggregate extends Document {
  deviceId: Types.ObjectId;
  metric: string;
  hourStart: Date;
  avg: number;
  max: number;
  min: number;
  count: number;
}

const hourlySchema = new Schema<ITelemetryHourlyAggregate>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true },
    metric: { type: String, required: true },
    hourStart: { type: Date, required: true },
    avg: Number,
    max: Number,
    min: Number,
    count: Number,
  },
  { timestamps: false },
);
hourlySchema.index({ deviceId: 1, metric: 1, hourStart: -1 }, { unique: true });
hourlySchema.index({ hourStart: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const TelemetryHourlyAggregate = mongoose.model<ITelemetryHourlyAggregate>(
  'TelemetryHourlyAggregate',
  hourlySchema,
);

export interface ITelemetryDailyAggregate extends Document {
  deviceId: Types.ObjectId;
  metric: string;
  dayStart: Date;
  avg: number;
  max: number;
  min: number;
  count: number;
}

const dailySchema = new Schema<ITelemetryDailyAggregate>(
  {
    deviceId: { type: Schema.Types.ObjectId, ref: 'ConnectedDevice', required: true },
    metric: { type: String, required: true },
    dayStart: { type: Date, required: true },
    avg: Number,
    max: Number,
    min: Number,
    count: Number,
  },
  { timestamps: false },
);
dailySchema.index({ deviceId: 1, metric: 1, dayStart: -1 }, { unique: true });

export const TelemetryDailyAggregate = mongoose.model<ITelemetryDailyAggregate>(
  'TelemetryDailyAggregate',
  dailySchema,
);

export interface IIoTIntegrationHealth extends Document {
  provider: IoTProviderType;
  connectionId?: Types.ObjectId;
  webhookFailures: number;
  authFailures: number;
  avgLatencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  updatedAt: Date;
}

const integrationHealthSchema = new Schema<IIoTIntegrationHealth>(
  {
    provider: { type: String, enum: Object.values(IoTProviderType), required: true, index: true },
    connectionId: { type: Schema.Types.ObjectId, ref: 'IoTIntegrationConnection' },
    webhookFailures: { type: Number, default: 0 },
    authFailures: { type: Number, default: 0 },
    avgLatencyMs: { type: Number, default: 0 },
    lastSuccessAt: Date,
    lastFailureAt: Date,
    lastError: String,
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const IoTIntegrationHealth = mongoose.model<IIoTIntegrationHealth>(
  'IoTIntegrationHealth',
  integrationHealthSchema,
);
