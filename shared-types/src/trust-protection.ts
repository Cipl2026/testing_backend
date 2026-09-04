/** Phase 18 — Trust & Customer Protection Platform */

export enum GuaranteePolicyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ProtectionClaimType {
  REPEAT_ISSUE = 'REPEAT_ISSUE',
  POOR_QUALITY = 'POOR_QUALITY',
  DAMAGE = 'DAMAGE',
  INCORRECT_SERVICE = 'INCORRECT_SERVICE',
  PART_FAILURE = 'PART_FAILURE',
  NO_SHOW = 'NO_SHOW',
  OTHER = 'OTHER',
}

export enum ProtectionClaimStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  AWAITING_CUSTOMER = 'AWAITING_CUSTOMER',
  AWAITING_PROVIDER = 'AWAITING_PROVIDER',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum ClaimResolutionType {
  FREE_REVISIT = 'FREE_REVISIT',
  REPLACEMENT = 'REPLACEMENT',
  REFUND = 'REFUND',
  PARTIAL_REFUND = 'PARTIAL_REFUND',
  REWORK = 'REWORK',
  CREDIT = 'CREDIT',
  NO_ACTION = 'NO_ACTION',
}

export enum ArrivalVerificationResult {
  ARRIVED = 'ARRIVED',
  NOT_ARRIVED = 'NOT_ARRIVED',
  INDETERMINATE = 'INDETERMINATE',
}

export enum PartApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum QualityInspectionResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

export enum QualityInspectionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ProviderQualityScoreStatus {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  WATCH = 'WATCH',
  AT_RISK = 'AT_RISK',
  RESTRICTED = 'RESTRICTED',
}

export enum ProviderQualityAction {
  COACHING = 'COACHING',
  TRAINING_REQUIRED = 'TRAINING_REQUIRED',
  INSPECTION = 'INSPECTION',
  LIMITED_ASSIGNMENTS = 'LIMITED_ASSIGNMENTS',
  TEMPORARY_RESTRICTION = 'TEMPORARY_RESTRICTION',
}

export enum ImprovementPlanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ServiceCertificationLevel {
  VERIFIED = 'VERIFIED',
  ADVANCED = 'ADVANCED',
  SPECIALIST = 'SPECIALIST',
}

export enum ServiceCertificationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  PENDING = 'PENDING',
}

export enum QualityChecklistStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum DamageAssessmentStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
}

export enum RevisitReason {
  REPEAT_ISSUE = 'REPEAT_ISSUE',
  GUARANTEE = 'GUARANTEE',
  CLAIM_RESOLUTION = 'CLAIM_RESOLUTION',
  QUALITY_REWORK = 'QUALITY_REWORK',
}

export interface GuaranteeSnapshotData {
  policyId: string;
  policyVersion: number;
  coverageDays: number;
  coveredIssueTypes: string[];
  exclusions: string[];
  maxClaims: number;
  resolutionOptions: ClaimResolutionType[];
  capturedAt: string;
}

export interface RepeatIssueSignal {
  detected: boolean;
  confidence: number;
  reasons: string[];
  advisoryOnly: true;
}
