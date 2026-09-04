/** Phase 15 — Trusted Marketplace */

export enum PaymentContext {
  BOOKING = 'BOOKING',
  SUBSCRIPTION = 'SUBSCRIPTION',
  MARKETPLACE = 'MARKETPLACE',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ProductVariantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum InventoryStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum BrandVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  OFFICIAL_PARTNER = 'OFFICIAL_PARTNER',
}

export enum MarketplacePartnerType {
  BRAND = 'BRAND',
  AUTHORIZED_SELLER = 'AUTHORIZED_SELLER',
  LOCAL_VENDOR = 'LOCAL_VENDOR',
  SPARE_PARTNER = 'SPARE_PARTNER',
  INSTALLATION_PARTNER = 'INSTALLATION_PARTNER',
}

export enum MarketplacePartnerStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export enum PartnerMemberRole {
  OWNER = 'OWNER',
  CATALOG_MANAGER = 'CATALOG_MANAGER',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  FULFILLMENT = 'FULFILLMENT',
  FINANCE = 'FINANCE',
  VIEWER = 'VIEWER',
}

export enum ProductApprovalStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum CompatibilityLevel {
  CONFIRMED = 'CONFIRMED',
  LIKELY = 'LIKELY',
  UNKNOWN = 'UNKNOWN',
  INCOMPATIBLE = 'INCOMPATIBLE',
}

export enum ProviderRecommendationType {
  REPAIR_RECOMMENDED = 'REPAIR_RECOMMENDED',
  PART_REPLACEMENT_RECOMMENDED = 'PART_REPLACEMENT_RECOMMENDED',
  FULL_REPLACEMENT_RECOMMENDED = 'FULL_REPLACEMENT_RECOMMENDED',
}

export enum ProductRecommendationSource {
  PROVIDER_DIAGNOSIS = 'PROVIDER_DIAGNOSIS',
  REPEATED_REPAIR = 'REPEATED_REPAIR',
  ASSET_AGE = 'ASSET_AGE',
  PREDICTIVE_MAINTENANCE = 'PREDICTIVE_MAINTENANCE',
  CUSTOMER_SEARCH = 'CUSTOMER_SEARCH',
  AI_RECOMMENDATION = 'AI_RECOMMENDATION',
}

export enum MarketplaceOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
  REFUNDED = 'REFUNDED',
}

export enum OrderFulfillmentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum DeliveryStatus {
  PROCESSING = 'PROCESSING',
  PICKED_UP = 'PICKED_UP',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export enum MarketplaceWarrantyStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
}

export enum ReturnRequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',
  RECEIVED = 'RECEIVED',
  REFUNDED = 'REFUNDED',
  CLOSED = 'CLOSED',
}

export enum PartnerSettlementStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  HYBRID = 'HYBRID',
}

export enum SparePartStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface CompatibilityCheckResult {
  level: CompatibilityLevel;
  reason: string;
  warnings: string[];
}

export interface MarketplacePricingLineItem {
  type: string;
  label: string;
  amount: number;
}

export interface MarketplacePricingResult {
  productSubtotal: number;
  deliveryFee: number;
  installationFee: number;
  subscriptionBenefit: number;
  promotionDiscount: number;
  rewardCredit: number;
  tax: number;
  finalAmount: number;
  currency: string;
  lineItems: MarketplacePricingLineItem[];
  commissionSnapshots: Array<{ partnerId: string; amount: number; rate: number }>;
}
