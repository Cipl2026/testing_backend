import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  AIAnalysisStatus,
  AIResourceType,
  AIReviewStatus,
  AssistantMessageRole,
  DemandForecastLevel,
  IntelligenceFeature,
  IntelligenceFeedbackType,
  IntelligenceModelStatus,
  KnowledgeSourceType,
  OperationalAnomalySeverity,
  OperationalAnomalyStatus,
  OperationalAnomalyType,
} from '@ghaarfix/shared-types';

export interface IAIAnalysisResult extends Document {
  customerId?: Types.ObjectId;
  feature: IntelligenceFeature;
  resourceType: AIResourceType;
  resourceId?: string;
  modelVersionId?: Types.ObjectId;
  modelName: string;
  modelVersion: string;
  provider: string;
  status: AIAnalysisStatus;
  reviewStatus: AIReviewStatus;
  inputHash?: string;
  result: Record<string, unknown>;
  confidence?: number;
  latencyMs?: number;
  costUnits?: number;
  errorMessage?: string;
  shadowMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const aiAnalysisSchema = new Schema<IAIAnalysisResult>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    feature: { type: String, enum: Object.values(IntelligenceFeature), required: true, index: true },
    resourceType: { type: String, enum: Object.values(AIResourceType), required: true },
    resourceId: { type: String },
    modelVersionId: { type: Schema.Types.ObjectId, ref: 'IntelligenceModelVersion' },
    modelName: { type: String, required: true },
    modelVersion: { type: String, required: true },
    provider: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(AIAnalysisStatus),
      default: AIAnalysisStatus.PENDING,
      index: true,
    },
    reviewStatus: {
      type: String,
      enum: Object.values(AIReviewStatus),
      default: AIReviewStatus.UNREVIEWED,
    },
    inputHash: { type: String, index: true },
    result: { type: Schema.Types.Mixed, default: {} },
    confidence: Number,
    latencyMs: Number,
    costUnits: { type: Number, default: 0 },
    errorMessage: String,
    shadowMode: { type: Boolean, default: false },
  },
  { timestamps: true },
);

aiAnalysisSchema.index({ resourceType: 1, resourceId: 1 });
aiAnalysisSchema.index({ feature: 1, createdAt: -1 });
aiAnalysisSchema.index({ customerId: 1, inputHash: 1, modelVersion: 1 });

export const AIAnalysisResult = mongoose.model<IAIAnalysisResult>(
  'AIAnalysisResult',
  aiAnalysisSchema,
);

export interface IIntelligenceModelVersion extends Document {
  feature: IntelligenceFeature;
  provider: string;
  modelName: string;
  version: string;
  status: IntelligenceModelStatus;
  metrics?: Record<string, number>;
  activatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const modelVersionSchema = new Schema<IIntelligenceModelVersion>(
  {
    feature: { type: String, enum: Object.values(IntelligenceFeature), required: true, index: true },
    provider: { type: String, required: true },
    modelName: { type: String, required: true },
    version: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(IntelligenceModelStatus),
      default: IntelligenceModelStatus.DRAFT,
      index: true,
    },
    metrics: { type: Schema.Types.Mixed },
    activatedAt: Date,
  },
  { timestamps: true },
);

modelVersionSchema.index({ feature: 1, version: 1 }, { unique: true });

export const IntelligenceModelVersion = mongoose.model<IIntelligenceModelVersion>(
  'IntelligenceModelVersion',
  modelVersionSchema,
);

export interface IIntelligenceFeedback extends Document {
  analysisId: Types.ObjectId;
  feature: IntelligenceFeature;
  customerId?: Types.ObjectId;
  providerId?: Types.ObjectId;
  userFeedback: IntelligenceFeedbackType;
  wasCorrect?: boolean;
  correctedValue?: string;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
}

const feedbackSchema = new Schema<IIntelligenceFeedback>(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: 'AIAnalysisResult', required: true, index: true },
    feature: { type: String, enum: Object.values(IntelligenceFeature), required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    providerId: { type: Schema.Types.ObjectId, ref: 'User' },
    userFeedback: { type: String, enum: Object.values(IntelligenceFeedbackType), required: true },
    wasCorrect: Boolean,
    correctedValue: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const IntelligenceFeedback = mongoose.model<IIntelligenceFeedback>(
  'IntelligenceFeedback',
  feedbackSchema,
);

export interface IOperationalAnomaly extends Document {
  type: OperationalAnomalyType;
  scope: string;
  severity: OperationalAnomalySeverity;
  baseline: number;
  observedValue: number;
  percentChange?: number;
  status: OperationalAnomalyStatus;
  metadata?: Record<string, unknown>;
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const anomalySchema = new Schema<IOperationalAnomaly>(
  {
    type: { type: String, enum: Object.values(OperationalAnomalyType), required: true, index: true },
    scope: { type: String, required: true, index: true },
    severity: { type: String, enum: Object.values(OperationalAnomalySeverity), required: true },
    baseline: { type: Number, required: true },
    observedValue: { type: Number, required: true },
    percentChange: Number,
    status: {
      type: String,
      enum: Object.values(OperationalAnomalyStatus),
      default: OperationalAnomalyStatus.OPEN,
      index: true,
    },
    metadata: Schema.Types.Mixed,
    detectedAt: { type: Date, required: true, index: true },
    acknowledgedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true },
);

anomalySchema.index({ type: 1, scope: 1, status: 1, detectedAt: -1 });

export const OperationalAnomaly = mongoose.model<IOperationalAnomaly>(
  'OperationalAnomaly',
  anomalySchema,
);

export interface IDemandForecast extends Document {
  cityId?: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  forecastStart: Date;
  forecastEnd: Date;
  level: DemandForecastLevel;
  expectedBookings: number;
  confidence: number;
  modelVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const forecastSchema = new Schema<IDemandForecast>(
  {
    cityId: { type: Schema.Types.ObjectId, ref: 'City', index: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    forecastStart: { type: Date, required: true, index: true },
    forecastEnd: { type: Date, required: true },
    level: { type: String, enum: Object.values(DemandForecastLevel), required: true },
    expectedBookings: { type: Number, required: true },
    confidence: { type: Number, default: 0.7 },
    modelVersion: { type: String, required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

forecastSchema.index({ cityId: 1, serviceZoneId: 1, serviceId: 1, forecastStart: 1 });

export const DemandForecast = mongoose.model<IDemandForecast>('DemandForecast', forecastSchema);

export interface IProviderMatchScore extends Document {
  bookingId?: Types.ObjectId;
  urgentRequestId?: Types.ObjectId;
  providerId: Types.ObjectId;
  totalScore: number;
  rank: number;
  factors: Array<{ factor: string; weight: number; score: number; description: string }>;
  modelVersion: string;
  selected: boolean;
  createdAt: Date;
}

const matchScoreSchema = new Schema<IProviderMatchScore>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    urgentRequestId: { type: Schema.Types.ObjectId, ref: 'UrgentRequest', index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    totalScore: { type: Number, required: true },
    rank: { type: Number, required: true },
    factors: [{ factor: String, weight: Number, score: Number, description: String }],
    modelVersion: { type: String, required: true },
    selected: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

matchScoreSchema.index({ bookingId: 1, providerId: 1 });

export const ProviderMatchScore = mongoose.model<IProviderMatchScore>(
  'ProviderMatchScore',
  matchScoreSchema,
);

export interface IKnowledgeSource extends Document {
  type: KnowledgeSourceType;
  title: string;
  slug: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeSourceSchema = new Schema<IKnowledgeSource>(
  {
    type: { type: String, enum: Object.values(KnowledgeSourceType), required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const KnowledgeSource = mongoose.model<IKnowledgeSource>(
  'KnowledgeSource',
  knowledgeSourceSchema,
);

export interface IKnowledgeChunk extends Document {
  sourceId: Types.ObjectId;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const knowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: 'KnowledgeSource', required: true, index: true },
    content: { type: String, required: true },
    embedding: [Number],
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const KnowledgeChunk = mongoose.model<IKnowledgeChunk>('KnowledgeChunk', knowledgeChunkSchema);

export interface IAIUsageMetric extends Document {
  feature: IntelligenceFeature;
  customerId?: Types.ObjectId;
  organizationId?: Types.ObjectId;
  period: string;
  requestCount: number;
  tokenCount: number;
  costUnits: number;
  failureCount: number;
  avgLatencyMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const usageMetricSchema = new Schema<IAIUsageMetric>(
  {
    feature: { type: String, enum: Object.values(IntelligenceFeature), required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    period: { type: String, required: true, index: true },
    requestCount: { type: Number, default: 0 },
    tokenCount: { type: Number, default: 0 },
    costUnits: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    avgLatencyMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

usageMetricSchema.index({ feature: 1, period: 1, customerId: 1 });

export const AIUsageMetric = mongoose.model<IAIUsageMetric>('AIUsageMetric', usageMetricSchema);

export interface IIntelligenceAuditLog extends Document {
  feature: IntelligenceFeature;
  provider: string;
  modelName: string;
  modelVersion: string;
  purpose: string;
  resourceType?: string;
  resourceId?: string;
  customerId?: Types.ObjectId;
  status: string;
  latencyMs?: number;
  costUnits?: number;
  createdAt: Date;
}

const auditSchema = new Schema<IIntelligenceAuditLog>(
  {
    feature: { type: String, enum: Object.values(IntelligenceFeature), required: true, index: true },
    provider: { type: String, required: true },
    modelName: { type: String, required: true },
    modelVersion: { type: String, required: true },
    purpose: { type: String, required: true },
    resourceType: String,
    resourceId: String,
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, required: true },
    latencyMs: Number,
    costUnits: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const IntelligenceAuditLog = mongoose.model<IIntelligenceAuditLog>(
  'IntelligenceAuditLog',
  auditSchema,
);

export interface IAssistantConversation extends Document {
  customerId: Types.ObjectId;
  title?: string;
  lastMessageAt: Date;
  handoffRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IAssistantConversation>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: String,
    lastMessageAt: { type: Date, default: Date.now },
    handoffRequested: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const AssistantConversation = mongoose.model<IAssistantConversation>(
  'AssistantConversation',
  conversationSchema,
);

export interface IAssistantMessage extends Document {
  conversationId: Types.ObjectId;
  role: AssistantMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  pendingAction?: Record<string, unknown>;
  createdAt: Date;
}

const messageSchema = new Schema<IAssistantMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'AssistantConversation',
      required: true,
      index: true,
    },
    role: { type: String, enum: Object.values(AssistantMessageRole), required: true },
    content: { type: String, required: true },
    metadata: Schema.Types.Mixed,
    pendingAction: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ createdAt: 1 });

export const AssistantMessage = mongoose.model<IAssistantMessage>(
  'AssistantMessage',
  messageSchema,
);

export interface IAIAnalysisJob extends Document {
  analysisId: Types.ObjectId;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  lastError?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IAIAnalysisJob>(
  {
    analysisId: { type: Schema.Types.ObjectId, ref: 'AIAnalysisResult', required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    lastError: String,
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

export const AIAnalysisJob = mongoose.model<IAIAnalysisJob>('AIAnalysisJob', jobSchema);
