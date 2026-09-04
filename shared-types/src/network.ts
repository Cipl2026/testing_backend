/** Phase 17 — Hyperlocal Network Intelligence */

export enum ServiceZoneOperationalStatus {
  PLANNED = 'PLANNED',
  LAUNCHING = 'LAUNCHING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  FULL = 'FULL',
}

export enum ZoneLaunchMode {
  INVITE_ONLY = 'INVITE_ONLY',
  LIMITED_HOURS = 'LIMITED_HOURS',
  LIMITED_SERVICES = 'LIMITED_SERVICES',
  FULL_LAUNCH = 'FULL_LAUNCH',
}

export enum SupplyDemandStatus {
  SURPLUS = 'SURPLUS',
  BALANCED = 'BALANCED',
  CONSTRAINED = 'CONSTRAINED',
  CRITICAL = 'CRITICAL',
}

export enum CoverageGapStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ACTIONED = 'ACTIONED',
  RESOLVED = 'RESOLVED',
}

export enum CoverageGapSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum RecruitmentSignalStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ACTIONED = 'ACTIONED',
  CLOSED = 'CLOSED',
}

export enum WaitTimeConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ProviderShiftStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ShiftRecommendationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum CoverageOpportunityStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum ZoneQualityStatus {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
  CRITICAL = 'CRITICAL',
}

export enum CityLaunchReadinessStatus {
  NOT_READY = 'NOT_READY',
  LIMITED_LAUNCH = 'LIMITED_LAUNCH',
  READY = 'READY',
}

export enum ExpansionTargetType {
  ZONE = 'ZONE',
  CITY = 'CITY',
  SERVICE = 'SERVICE',
}

export enum ExpansionRecommendationStatus {
  PENDING = 'PENDING',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PILOT = 'IN_PILOT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum SupplyAlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SupplyAlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum SlotIntelligenceStatus {
  AVAILABLE = 'AVAILABLE',
  LIMITED = 'LIMITED',
  AT_RISK = 'AT_RISK',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum CapacityPlanScope {
  ZONE = 'ZONE',
  CITY = 'CITY',
  SERVICE = 'SERVICE',
}

export enum FeatureFlagKeyNetwork {
  ENABLE_NETWORK_INTELLIGENCE = 'ENABLE_NETWORK_INTELLIGENCE',
}

export interface WaitTimeEstimate {
  minMinutes: number;
  maxMinutes: number;
  confidence: WaitTimeConfidence;
  label: string;
  disclaimer?: string;
}

export interface SupplyDemandResult {
  status: SupplyDemandStatus;
  supplyDemandRatio: number;
  availableProviders: number;
  estimatedDemand: number;
  explanation: string;
}
