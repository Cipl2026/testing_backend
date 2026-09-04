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
}

export * from './catalog.js';
export * from './booking.js';
export * from './urgent.js';
export * from './post-service.js';
export * from './home-health.js';
export * from './home-sharing.js';
export * from './provider-quality.js';
export * from './discovery-growth.js';
"}},{"type":"tool_use","name":"Write","input":{"path":"/Users/deependrakumar/Downloads/Ghaarfix/server/shared-types/src/catalog.ts","contents":"