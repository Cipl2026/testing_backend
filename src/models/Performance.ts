import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  CapacityRiskLevel,
  IndexRecommendationStatus,
  LoadTestScenarioType,
  LoadTestStatus,
  PerformanceBudgetMetric,
  PerformanceRegressionSeverity,
  PerformanceRegressionStatus,
} from '@ghaarfix/shared-types';

export interface IPerformanceBaselineSnapshot extends Document {
  environment: string;
  release: string;
  windowStart: Date;
  windowEnd: Date;
  apiP50Ms: number;
  apiP95Ms: number;
  apiP99Ms: number;
  errorRate: number;
  dbQueryP50Ms: number;
  dbQueryP95Ms: number;
  cacheHitRate: number;
  queueLagMs: number;
  queueThroughput: number;
  socketConnections: number;
  memoryMb: number;
  cpuPercent: number;
  routeMetrics: Array<{ route: string; p95Ms: number; count: number }>;
  createdAt: Date;
}

const baselineSchema = new Schema<IPerformanceBaselineSnapshot>(
  {
    environment: { type: String, required: true, index: true },
    release: { type: String, required: true, index: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    apiP50Ms: Number,
    apiP95Ms: Number,
    apiP99Ms: Number,
    errorRate: Number,
    dbQueryP50Ms: Number,
    dbQueryP95Ms: Number,
    cacheHitRate: Number,
    queueLagMs: Number,
    queueThroughput: Number,
    socketConnections: Number,
    memoryMb: Number,
    cpuPercent: Number,
    routeMetrics: [{ route: String, p95Ms: Number, count: Number }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

baselineSchema.index({ environment: 1, createdAt: -1 });

export const PerformanceBaselineSnapshot = mongoose.model<IPerformanceBaselineSnapshot>(
  'PerformanceBaselineSnapshot',
  baselineSchema,
);

export interface IPerformanceBudget extends Document {
  resource: string;
  metric: PerformanceBudgetMetric;
  target: number;
  warningThreshold: number;
  criticalThreshold: number;
  environment: string;
  owner: string;
  updatedAt: Date;
}

const budgetSchema = new Schema<IPerformanceBudget>(
  {
    resource: { type: String, required: true },
    metric: { type: String, enum: Object.values(PerformanceBudgetMetric), required: true },
    target: { type: Number, required: true },
    warningThreshold: { type: Number, required: true },
    criticalThreshold: { type: Number, required: true },
    environment: { type: String, required: true, index: true },
    owner: { type: String, default: 'Platform Team' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

budgetSchema.index({ environment: 1, resource: 1, metric: 1 }, { unique: true });

export const PerformanceBudget = mongoose.model<IPerformanceBudget>(
  'PerformanceBudget',
  budgetSchema,
);

export interface ISlowQueryRecord extends Document {
  operation: string;
  collectionName: string;
  queryFingerprint: string;
  durationMs: number;
  documentsExamined?: number;
  keysExamined?: number;
  returnedCount?: number;
  timestamp: Date;
}

const slowQuerySchema = new Schema<ISlowQueryRecord>(
  {
    operation: { type: String, required: true },
    collectionName: { type: String, required: true, index: true },
    queryFingerprint: { type: String, required: true, index: true },
    durationMs: { type: Number, required: true },
    documentsExamined: Number,
    keysExamined: Number,
    returnedCount: Number,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

slowQuerySchema.index({ collectionName: 1, timestamp: -1 });
slowQuerySchema.index({ queryFingerprint: 1, timestamp: -1 });

export const SlowQueryRecord = mongoose.model<ISlowQueryRecord>(
  'SlowQueryRecord',
  slowQuerySchema,
);

export interface IIndexRecommendation extends Document {
  collectionName: string;
  queryPattern: string;
  recommendedIndex: Record<string, number>;
  reason: string;
  estimatedImpact: string;
  status: IndexRecommendationStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

const indexRecSchema = new Schema<IIndexRecommendation>(
  {
    collectionName: { type: String, required: true, index: true },
    queryPattern: { type: String, required: true },
    recommendedIndex: { type: Schema.Types.Mixed, required: true },
    reason: String,
    estimatedImpact: String,
    status: {
      type: String,
      enum: Object.values(IndexRecommendationStatus),
      default: IndexRecommendationStatus.PENDING,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const IndexRecommendation = mongoose.model<IIndexRecommendation>(
  'IndexRecommendation',
  indexRecSchema,
);

export interface ILoadTestScenario extends Document {
  name: string;
  type: LoadTestScenarioType;
  target: string;
  trafficPattern: string;
  durationSeconds: number;
  concurrency: number;
  expectedSlo: Record<string, number>;
  environment: string;
  status: LoadTestStatus;
  createdAt: Date;
}

const loadTestScenarioSchema = new Schema<ILoadTestScenario>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(LoadTestScenarioType), required: true },
    target: String,
    trafficPattern: String,
    durationSeconds: { type: Number, default: 60 },
    concurrency: { type: Number, default: 10 },
    expectedSlo: Schema.Types.Mixed,
    environment: { type: String, default: 'staging', index: true },
    status: {
      type: String,
      enum: Object.values(LoadTestStatus),
      default: LoadTestStatus.DRAFT,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const LoadTestScenario = mongoose.model<ILoadTestScenario>(
  'LoadTestScenario',
  loadTestScenarioSchema,
);

export interface ILoadTestResult extends Document {
  scenarioId: Types.ObjectId;
  environment: string;
  release: string;
  durationSeconds: number;
  concurrency: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  totalRequests: number;
  sloPassed: boolean;
  createdAt: Date;
}

const loadTestResultSchema = new Schema<ILoadTestResult>(
  {
    scenarioId: { type: Schema.Types.ObjectId, ref: 'LoadTestScenario', required: true, index: true },
    environment: String,
    release: String,
    durationSeconds: Number,
    concurrency: Number,
    p50Ms: Number,
    p95Ms: Number,
    p99Ms: Number,
    errorRate: Number,
    totalRequests: Number,
    sloPassed: Boolean,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

loadTestResultSchema.index({ scenarioId: 1, createdAt: -1 });

export const LoadTestResult = mongoose.model<ILoadTestResult>(
  'LoadTestResult',
  loadTestResultSchema,
);

export interface ICapacityPlan extends Document {
  scope: string;
  environment: string;
  currentBaseline: Record<string, number>;
  expectedGrowthPercent: number;
  peakTrafficMultiplier: number;
  riskLevel: CapacityRiskLevel;
  projectedCapacityDate?: Date;
  confidence: number;
  recommendedAction?: string;
  updatedAt: Date;
}

const capacitySchema = new Schema<ICapacityPlan>(
  {
    scope: { type: String, required: true, index: true },
    environment: { type: String, required: true },
    currentBaseline: Schema.Types.Mixed,
    expectedGrowthPercent: { type: Number, default: 20 },
    peakTrafficMultiplier: { type: Number, default: 3 },
    riskLevel: {
      type: String,
      enum: Object.values(CapacityRiskLevel),
      default: CapacityRiskLevel.NORMAL,
    },
    projectedCapacityDate: Date,
    confidence: { type: Number, default: 0.7 },
    recommendedAction: String,
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

capacitySchema.index({ scope: 1, environment: 1 }, { unique: true });
capacitySchema.index({ scope: 1, updatedAt: -1 });

export const CapacityPlan = mongoose.model<ICapacityPlan>('CapacityPlan', capacitySchema);

export interface ICostUsageSnapshot extends Document {
  environment: string;
  periodStart: Date;
  periodEnd: Date;
  databaseUsageMb: number;
  storageUsageMb: number;
  bandwidthMb: number;
  queueJobsProcessed: number;
  notificationCount: number;
  aiRequestCount: number;
  externalApiCalls: number;
  allocation: Record<string, number>;
  createdAt: Date;
}

const costSchema = new Schema<ICostUsageSnapshot>(
  {
    environment: { type: String, required: true, index: true },
    periodStart: Date,
    periodEnd: Date,
    databaseUsageMb: Number,
    storageUsageMb: Number,
    bandwidthMb: Number,
    queueJobsProcessed: Number,
    notificationCount: Number,
    aiRequestCount: Number,
    externalApiCalls: Number,
    allocation: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CostUsageSnapshot = mongoose.model<ICostUsageSnapshot>(
  'CostUsageSnapshot',
  costSchema,
);

export interface IPerformanceRegression extends Document {
  release: string;
  previousRelease: string;
  metric: string;
  resource: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  severity: PerformanceRegressionSeverity;
  status: PerformanceRegressionStatus;
  detectedAt: Date;
}

const regressionSchema = new Schema<IPerformanceRegression>(
  {
    release: String,
    previousRelease: String,
    metric: String,
    resource: String,
    previousValue: Number,
    currentValue: Number,
    changePercent: Number,
    severity: {
      type: String,
      enum: Object.values(PerformanceRegressionSeverity),
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PerformanceRegressionStatus),
      default: PerformanceRegressionStatus.OPEN,
      index: true,
    },
    detectedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

regressionSchema.index({ status: 1, severity: 1 });

export const PerformanceRegression = mongoose.model<IPerformanceRegression>(
  'PerformanceRegression',
  regressionSchema,
);

export interface IAnalyticsReadModelSnapshot extends Document {
  key: string;
  data: Record<string, unknown>;
  computedAt: Date;
  expiresAt: Date;
}

const analyticsSnapshotSchema = new Schema<IAnalyticsReadModelSnapshot>(
  {
    key: { type: String, required: true, unique: true, index: true },
    data: Schema.Types.Mixed,
    computedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: false },
);

export const AnalyticsReadModelSnapshot = mongoose.model<IAnalyticsReadModelSnapshot>(
  'AnalyticsReadModelSnapshot',
  analyticsSnapshotSchema,
);
