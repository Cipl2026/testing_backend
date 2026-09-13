export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  PROVIDER = 'PROVIDER',
  ADMIN = 'ADMIN',
}

export enum ProviderStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** Phase 21 — extended taxonomy */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
  TIMEOUT = 'TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
}

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  data: null;
  requestId?: string;
}

export * from './catalog.js';
export * from './booking.js';
export * from './home-help.js';
export * from './urgent.js';
export * from './post-service.js';
export * from './home-health.js';
export * from './home-sharing.js';
export * from './provider-quality.js';
export * from './discovery-growth.js';
export * from './operations.js';
export * from './care-plans.js';
export * from './organizations.js';
export * from './intelligence.js';
export * from './marketplace.js';
export * from './iot.js';
export * from './network.js';
export * from './trust-protection.js';
export * from './finance.js';
export * from './customer-lifecycle.js';
export * from './reliability.js';
export * from './security.js';
export * from './performance.js';
export * from './globalization.js';
export * from './booking-pricing.js';
