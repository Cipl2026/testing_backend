/** Phase 24 — Globalization, Multi-City & Multi-Region */

export enum RegionType {
  GLOBAL = 'GLOBAL',
  COUNTRY = 'COUNTRY',
  STATE = 'STATE',
  CITY = 'CITY',
  SERVICE_AREA = 'SERVICE_AREA',
}

export enum RegionServiceAreaType {
  POLYGON = 'POLYGON',
  RADIUS = 'RADIUS',
  POSTAL_CODE = 'POSTAL_CODE',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
}

export enum RegionLaunchStatus {
  DRAFT = 'DRAFT',
  CONFIGURING = 'CONFIGURING',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum LaunchChecklistItemStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum RegionalCatalogStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  COMING_SOON = 'COMING_SOON',
  RESTRICTED = 'RESTRICTED',
}

export enum ProviderComplianceStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum PartnerStatus {
  APPLIED = 'APPLIED',
  REVIEWING = 'REVIEWING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export enum PartnerAgreementType {
  COMMISSION = 'COMMISSION',
  REVENUE_SHARE = 'REVENUE_SHARE',
  FIXED_FEE = 'FIXED_FEE',
}

export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED',
}

export enum ApiScope {
  BOOKING_READ = 'booking.read',
  BOOKING_CREATE = 'booking.create',
  PROVIDER_READ = 'provider.read',
  CATALOG_READ = 'catalog.read',
  FINANCE_READ = 'finance.read',
}

export enum PaymentMethodType {
  UPI = 'UPI',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAY_ON_SERVICE = 'PAY_ON_SERVICE',
  WALLET = 'WALLET',
}

export enum TaxInclusionMode {
  INCLUSIVE = 'INCLUSIVE',
  EXCLUSIVE = 'EXCLUSIVE',
}

export const GLOBAL_DEFAULT_LOCALE = 'en';
export const GLOBAL_DEFAULT_CURRENCY = 'INR';
export const GLOBAL_DEFAULT_TIMEZONE = 'UTC';
