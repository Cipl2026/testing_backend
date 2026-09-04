/** Phase 21 — Reliability, Observability & Disaster Recovery */

export enum ReliabilityErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  TIMEOUT = 'TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export enum JobPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
  LOW = 'LOW',
}

export enum RateLimitCategory {
  AUTH = 'AUTH',
  OTP = 'OTP',
  PAYMENT = 'PAYMENT',
  BOOKING = 'BOOKING',
  URGENT_BOOKING = 'URGENT_BOOKING',
  WEBHOOK = 'WEBHOOK',
  GENERAL_API = 'GENERAL_API',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  MITIGATED = 'MITIGATED',
  RESOLVED = 'RESOLVED',
  POSTMORTEM_PENDING = 'POSTMORTEM_PENDING',
  CLOSED = 'CLOSED',
}

export enum IncidentSeverity {
  SEV1 = 'SEV1',
  SEV2 = 'SEV2',
  SEV3 = 'SEV3',
  SEV4 = 'SEV4',
}

export enum SloStatus {
  HEALTHY = 'HEALTHY',
  AT_RISK = 'AT_RISK',
  BREACHED = 'BREACHED',
}

export enum DlqJobStatus {
  DEAD_LETTER = 'DEAD_LETTER',
  PENDING_RETRY = 'PENDING_RETRY',
  RETRYING = 'RETRYING',
  DISCARDED = 'DISCARDED',
}

export enum BackupVerificationStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

export enum MaintenanceMode {
  NONE = 'NONE',
  READ_ONLY = 'READ_ONLY',
  LIMITED = 'LIMITED',
  FULL = 'FULL',
}

export const DEFAULT_SLO_DEFINITIONS = [
  {
    key: 'api-availability',
    name: 'API Availability',
    service: 'api',
    metric: 'http_success_rate',
    target: 0.999,
    windowDays: 30,
    severity: AlertSeverity.CRITICAL,
  },
  {
    key: 'booking-creation',
    name: 'Booking Creation Success',
    service: 'booking',
    metric: 'booking_created_success_rate',
    target: 0.999,
    windowDays: 30,
    severity: AlertSeverity.CRITICAL,
  },
  {
    key: 'payment-webhook',
    name: 'Payment Webhook Processing',
    service: 'payment',
    metric: 'payment_webhook_success_rate',
    target: 0.9999,
    windowDays: 30,
    severity: AlertSeverity.CRITICAL,
  },
  {
    key: 'api-latency-p95',
    name: 'Critical API p95 Latency',
    service: 'api',
    metric: 'http_latency_p95_ms',
    target: 2000,
    windowDays: 7,
    severity: AlertSeverity.WARNING,
    isLatency: true,
  },
] as const;
