export enum ProviderVerificationType {
  IDENTITY = 'IDENTITY',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  SKILL_CERTIFICATE = 'SKILL_CERTIFICATE',
}

export enum ProviderVerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum ProviderVerificationDocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ProviderSkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum ProviderSkillStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum PerformancePeriod {
  SEVEN_DAYS = 'SEVEN_DAYS',
  THIRTY_DAYS = 'THIRTY_DAYS',
  NINETY_DAYS = 'NINETY_DAYS',
  ALL_TIME = 'ALL_TIME',
}

export enum ProviderQualityStatus {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  NEEDS_ATTENTION = 'NEEDS_ATTENTION',
}

export enum OperationalRiskEntityType {
  PROVIDER = 'PROVIDER',
  BOOKING = 'BOOKING',
  CUSTOMER = 'CUSTOMER',
}

export enum OperationalRiskSignalType {
  HIGH_CANCELLATION_RATE = 'HIGH_CANCELLATION_RATE',
  EXCESSIVE_PRICE_CHANGE_REQUESTS = 'EXCESSIVE_PRICE_CHANGE_REQUESTS',
  REPEATED_CUSTOMER_COMPLAINTS = 'REPEATED_CUSTOMER_COMPLAINTS',
}

export enum OperationalRiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum OperationalRiskSignalStatus {
  NEW = 'NEW',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DISMISSED = 'DISMISSED',
  RESOLVED = 'RESOLVED',
}
","path":"/Users/deependrakumar/Downloads/Ghaarfix/server/shared-types/src/provider-quality.ts"}},{"type":"tool_use","name":"Write","input":{"contents":"