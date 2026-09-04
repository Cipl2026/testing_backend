/** Phase 13 — Organization & Property Management */

export enum OrganizationType {
  RWA = 'RWA',
  SOCIETY = 'SOCIETY',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  LANDLORD = 'LANDLORD',
  COMMERCIAL = 'COMMERCIAL',
  OFFICE = 'OFFICE',
  DEVELOPER = 'DEVELOPER',
}

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum OrganizationMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  FINANCE = 'FINANCE',
  OPERATIONS = 'OPERATIONS',
  VIEWER = 'VIEWER',
}

export enum OrganizationMemberStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
}

export enum OrganizationPermission {
  MANAGE_PROPERTIES = 'MANAGE_PROPERTIES',
  CREATE_BOOKING = 'CREATE_BOOKING',
  APPROVE_BOOKING = 'APPROVE_BOOKING',
  VIEW_FINANCE = 'VIEW_FINANCE',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  MANAGE_BILLING = 'MANAGE_BILLING',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
}

export enum ManagedPropertyType {
  RESIDENTIAL_HOME = 'RESIDENTIAL_HOME',
  APARTMENT = 'APARTMENT',
  BUILDING = 'BUILDING',
  OFFICE = 'OFFICE',
  SHOP = 'SHOP',
  COMMERCIAL = 'COMMERCIAL',
  COMMON_AREA = 'COMMON_AREA',
}

export enum ManagedPropertyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum PropertyUnitStatus {
  ACTIVE = 'ACTIVE',
  VACANT = 'VACANT',
  ARCHIVED = 'ARCHIVED',
}

export enum PropertyOccupantType {
  OWNER = 'OWNER',
  TENANT = 'TENANT',
  EMPLOYEE = 'EMPLOYEE',
  RESIDENT = 'RESIDENT',
}

export enum PropertyOccupantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REMOVED = 'REMOVED',
}

export enum BookingContextType {
  PERSONAL = 'PERSONAL',
  FAMILY_HOME = 'FAMILY_HOME',
  ORGANIZATION = 'ORGANIZATION',
}

export enum ApprovalRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ApprovalResourceType {
  BOOKING = 'BOOKING',
  BULK_BOOKING = 'BULK_BOOKING',
  INVOICE = 'INVOICE',
}

export enum ApprovalTriggerType {
  BOOKING_AMOUNT = 'BOOKING_AMOUNT',
  SERVICE_CATEGORY = 'SERVICE_CATEGORY',
  EMERGENCY = 'EMERGENCY',
  BUDGET_THRESHOLD = 'BUDGET_THRESHOLD',
}

export enum BulkBookingStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  PARTIAL = 'PARTIAL',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum BulkBookingItemStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  CREATED = 'CREATED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum MaintenanceFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum OrganizationMaintenanceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export enum SLAPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SLAStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  BREACHED = 'BREACHED',
}

export enum OrganizationPricingMode {
  STANDARD = 'STANDARD',
  NEGOTIATED = 'NEGOTIATED',
  CONTRACT = 'CONTRACT',
}

export enum OrganizationBudgetPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum OrganizationInvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}

export enum OrganizationPaymentTerms {
  PREPAID = 'PREPAID',
  NET_7 = 'NET_7',
  NET_15 = 'NET_15',
  NET_30 = 'NET_30',
}

export enum PropertyHealthStatus {
  HEALTHY = 'HEALTHY',
  ATTENTION = 'ATTENTION',
  AT_RISK = 'AT_RISK',
  CRITICAL = 'CRITICAL',
}

export enum WorkOrderStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrganizationBillingMode {
  PER_BOOKING = 'PER_BOOKING',
  CONSOLIDATED = 'CONSOLIDATED',
}
