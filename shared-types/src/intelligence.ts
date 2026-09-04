/** Phase 14 — Intelligence Platform */

export enum IntelligenceFeature {
  ISSUE_CLASSIFICATION = 'ISSUE_CLASSIFICATION',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  PREDICTIVE_MAINTENANCE = 'PREDICTIVE_MAINTENANCE',
  SMART_PROVIDER_MATCHING = 'SMART_PROVIDER_MATCHING',
  DEMAND_FORECAST = 'DEMAND_FORECAST',
  ANOMALY_DETECTION = 'ANOMALY_DETECTION',
  SUPPORT_ASSISTANT = 'SUPPORT_ASSISTANT',
}

export enum IntelligenceFeatureFlagKey {
  ENABLE_AI_ISSUE_CLASSIFICATION = 'ENABLE_AI_ISSUE_CLASSIFICATION',
  ENABLE_AI_IMAGE_ANALYSIS = 'ENABLE_AI_IMAGE_ANALYSIS',
  ENABLE_AI_ASSISTANT = 'ENABLE_AI_ASSISTANT',
  ENABLE_PREDICTIVE_MAINTENANCE = 'ENABLE_PREDICTIVE_MAINTENANCE',
  ENABLE_SMART_MATCHING = 'ENABLE_SMART_MATCHING',
  ENABLE_DEMAND_FORECAST = 'ENABLE_DEMAND_FORECAST',
  ENABLE_ANOMALY_DETECTION = 'ENABLE_ANOMALY_DETECTION',
}

export enum AIAnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AIReviewStatus {
  UNREVIEWED = 'UNREVIEWED',
  CONFIRMED = 'CONFIRMED',
  CORRECTED = 'CORRECTED',
  REJECTED = 'REJECTED',
}

export enum AIResourceType {
  ISSUE_TEXT = 'ISSUE_TEXT',
  ISSUE_IMAGE = 'ISSUE_IMAGE',
  HOME = 'HOME',
  ASSET = 'ASSET',
  BOOKING = 'BOOKING',
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum IssueUrgency {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

export enum PredictiveMaintenanceRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum IntelligenceModelStatus {
  DRAFT = 'DRAFT',
  SHADOW = 'SHADOW',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
}

export enum OperationalAnomalyType {
  CANCELLATION_SPIKE = 'CANCELLATION_SPIKE',
  PROVIDER_NO_SHOW_SPIKE = 'PROVIDER_NO_SHOW_SPIKE',
  COMPLAINT_SPIKE = 'COMPLAINT_SPIKE',
  PAYMENT_FAILURE_SPIKE = 'PAYMENT_FAILURE_SPIKE',
  ZONE_SUPPLY_SHORTAGE = 'ZONE_SUPPLY_SHORTAGE',
  URGENT_ACCEPTANCE_FAILURE = 'URGENT_ACCEPTANCE_FAILURE',
}

export enum OperationalAnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum OperationalAnomalyStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum DemandForecastLevel {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export enum KnowledgeSourceType {
  FAQ = 'FAQ',
  POLICY = 'POLICY',
  SERVICE_DOCUMENT = 'SERVICE_DOCUMENT',
  APPROVED_HELP_CONTENT = 'APPROVED_HELP_CONTENT',
}

export enum AssistantMessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
}

export enum AssistantActionType {
  GET_MY_BOOKING = 'GET_MY_BOOKING',
  GET_MY_SUBSCRIPTION = 'GET_MY_SUBSCRIPTION',
  CREATE_SUPPORT_TICKET = 'CREATE_SUPPORT_TICKET',
  CANCEL_BOOKING = 'CANCEL_BOOKING',
  RESCHEDULE_BOOKING = 'RESCHEDULE_BOOKING',
}

export enum IntelligenceFeedbackType {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL',
  INCORRECT = 'INCORRECT',
}

export enum AIProviderType {
  RULE_BASED = 'RULE_BASED',
  EXTERNAL = 'EXTERNAL',
}

/** Structured issue classification — validated before use */
export interface IssueClassificationResult {
  category: string;
  categoryId?: string;
  serviceId?: string;
  serviceName?: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  urgency: IssueUrgency;
  riskFlags: string[];
  followUpQuestions: string[];
  explanation: string;
  safetyEscalation?: boolean;
  safetyMessage?: string;
}

export interface ImageClassificationResult {
  detectedIssues: string[];
  applianceType?: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  explanation: string;
  requiresHumanReview: boolean;
}

export interface ProviderMatchFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

export interface ProviderMatchExplanation {
  providerId: string;
  totalScore: number;
  factors: ProviderMatchFactor[];
  summary: string;
}

export const INTELLIGENCE_ANALYTICS_EVENTS = [
  'ISSUE_ANALYZED',
  'ISSUE_RECOMMENDATION_ACCEPTED',
  'ISSUE_RECOMMENDATION_DISMISSED',
  'PREDICTIVE_MAINTENANCE_VIEWED',
  'PREDICTIVE_MAINTENANCE_BOOKED',
  'ASSISTANT_MESSAGE_SENT',
  'ASSISTANT_HANDOFF',
  'AI_FEEDBACK_SUBMITTED',
  'IMAGE_ANALYSIS_COMPLETED',
] as const;

export type IntelligenceAnalyticsEvent = (typeof INTELLIGENCE_ANALYTICS_EVENTS)[number];
