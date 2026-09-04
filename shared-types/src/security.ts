/** Phase 22 — Security, Privacy & Enterprise Compliance */

export enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

export enum ConsentType {
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  MARKETING_PUSH = 'MARKETING_PUSH',
  MARKETING_EMAIL = 'MARKETING_EMAIL',
  MARKETING_SMS = 'MARKETING_SMS',
  OPTIONAL_PERSONALIZATION = 'OPTIONAL_PERSONALIZATION',
}

export enum ConsentStatus {
  GRANTED = 'GRANTED',
  WITHDRAWN = 'WITHDRAWN',
  PENDING = 'PENDING',
}

export enum SecurityEventType {
  LOGIN_FAILURE_SPIKE = 'LOGIN_FAILURE_SPIKE',
  TOKEN_REUSE = 'TOKEN_REUSE',
  OTP_ABUSE = 'OTP_ABUSE',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',
  IDOR_ATTEMPT = 'IDOR_ATTEMPT',
  RATE_LIMIT_ABUSE = 'RATE_LIMIT_ABUSE',
  WEBHOOK_FORGERY = 'WEBHOOK_FORGERY',
  MALICIOUS_FILE = 'MALICIOUS_FILE',
  ADMIN_ANOMALY = 'ADMIN_ANOMALY',
  SESSION_REVOKED = 'SESSION_REVOKED',
  STEP_UP_REQUIRED = 'STEP_UP_REQUIRED',
  STEP_UP_COMPLETED = 'STEP_UP_COMPLETED',
}

export enum SecurityEventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SecurityEventStatus {
  OPEN = 'OPEN',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
}

export enum SecurityFindingSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SecurityFindingStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACCEPTED_RISK = 'ACCEPTED_RISK',
  RESOLVED = 'RESOLVED',
}

export enum ThreatRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ThreatStatus {
  OPEN = 'OPEN',
  MITIGATED = 'MITIGATED',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
}

export enum DataExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum AccountDeletionStatus {
  REQUESTED = 'REQUESTED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SCHEDULED = 'SCHEDULED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum RetentionAction {
  DELETE = 'DELETE',
  ANONYMIZE = 'ANONYMIZE',
  ARCHIVE = 'ARCHIVE',
  RESTRICT = 'RESTRICT',
}

export enum StepUpMethod {
  OTP = 'OTP',
  MPIN = 'MPIN',
  MFA = 'MFA',
}

export enum StepUpStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum SecurityPermission {
  BOOKING_READ = 'booking.read',
  BOOKING_WRITE = 'booking.write',
  PAYMENT_REFUND = 'payment.refund',
  FINANCE_ADJUST = 'finance.adjust',
  PROVIDER_VERIFY = 'provider.verify',
  ORGANIZATION_MANAGE = 'organization.manage',
  SECURITY_AUDIT_READ = 'security.audit.read',
  SECURITY_MANAGE = 'security.manage',
  USER_MANAGE = 'user.manage',
  ROLE_MANAGE = 'role.manage',
}

export const DEFAULT_RETENTION_POLICIES = [
  {
    dataType: 'booking_records',
    retentionDays: 2555,
    actionAfterExpiry: RetentionAction.ARCHIVE,
    legalBasis: 'Contract and tax compliance',
  },
  {
    dataType: 'financial_ledger',
    retentionDays: 2555,
    actionAfterExpiry: RetentionAction.RESTRICT,
    legalBasis: 'Financial record retention',
  },
  {
    dataType: 'marketing_consent',
    retentionDays: 1095,
    actionAfterExpiry: RetentionAction.ANONYMIZE,
    legalBasis: 'Consent audit trail',
  },
  {
    dataType: 'security_events',
    retentionDays: 365,
    actionAfterExpiry: RetentionAction.ARCHIVE,
    legalBasis: 'Security monitoring',
  },
] as const;
