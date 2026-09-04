import mongoose, { Schema, type Document, type Types } from 'mongoose';
import {
  BrandVerificationStatus,
  CommissionType,
  CompatibilityLevel,
  DeliveryStatus,
  InventoryStatus,
  MarketplaceOrderStatus,
  MarketplacePartnerStatus,
  MarketplacePartnerType,
  MarketplaceWarrantyStatus,
  OrderFulfillmentStatus,
  PartnerMemberRole,
  PartnerSettlementStatus,
  ProductApprovalStatus,
  ProductRecommendationSource,
  ProductStatus,
  ProductVariantStatus,
  ProviderRecommendationType,
  ReturnRequestStatus,
  SparePartStatus,
} from '@ghaarfix/shared-types';
import { PaymentStatus } from '@ghaarfix/shared-types';

export interface IBrand extends Document {
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  verificationStatus: BrandVerificationStatus;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    logo: String,
    website: String,
    verificationStatus: {
      type: String,
      enum: Object.values(BrandVerificationStatus),
      default: BrandVerificationStatus.UNVERIFIED,
    },
    status: { type: String, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

export const Brand = mongoose.model<IBrand>('Brand', brandSchema);

export interface IMarketplacePartner extends Document {
  name: string;
  slug: string;
  type: MarketplacePartnerType;
  status: MarketplacePartnerStatus;
  businessDetails: Record<string, unknown>;
  serviceZoneIds: Types.ObjectId[];
  commissionConfig: Record<string, unknown>;
  verificationMetadata?: Record<string, unknown>;
  isTrustedPublisher: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IMarketplacePartner>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    type: { type: String, enum: Object.values(MarketplacePartnerType), required: true },
    status: {
      type: String,
      enum: Object.values(MarketplacePartnerStatus),
      default: MarketplacePartnerStatus.PENDING,
      index: true,
    },
    businessDetails: { type: Schema.Types.Mixed, default: {} },
    serviceZoneIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceZone' }],
    commissionConfig: { type: Schema.Types.Mixed, default: {} },
    verificationMetadata: Schema.Types.Mixed,
    isTrustedPublisher: { type: Boolean, default: false },
  },
  { timestamps: true },
);

partnerSchema.index({ status: 1, type: 1 });

export const MarketplacePartner = mongoose.model<IMarketplacePartner>(
  'MarketplacePartner',
  partnerSchema,
);

export interface IPartnerMember extends Document {
  partnerId: Types.ObjectId;
  userId: Types.ObjectId;
  role: PartnerMemberRole;
  status: string;
  joinedAt: Date;
}

const partnerMemberSchema = new Schema<IPartnerMember>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: Object.values(PartnerMemberRole), required: true },
    status: { type: String, default: 'ACTIVE' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

partnerMemberSchema.index({ partnerId: 1, userId: 1 }, { unique: true });

export const PartnerMember = mongoose.model<IPartnerMember>('PartnerMember', partnerMemberSchema);

export interface IProduct extends Document {
  name: string;
  slug: string;
  brandId: Types.ObjectId;
  categoryId?: Types.ObjectId;
  partnerId: Types.ObjectId;
  description?: string;
  status: ProductStatus;
  approvalStatus: ProductApprovalStatus;
  media: string[];
  attributes: Record<string, unknown>;
  isInstallable: boolean;
  requiresProfessionalInstallation: boolean;
  warrantyConfig?: Record<string, unknown>;
  returnPolicyDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true, index: true },
    description: String,
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: Object.values(ProductApprovalStatus),
      default: ProductApprovalStatus.DRAFT,
      index: true,
    },
    media: [String],
    attributes: { type: Schema.Types.Mixed, default: {} },
    isInstallable: { type: Boolean, default: false },
    requiresProfessionalInstallation: { type: Boolean, default: false },
    warrantyConfig: Schema.Types.Mixed,
    returnPolicyDays: { type: Number, default: 7 },
  },
  { timestamps: true },
);

export const Product = mongoose.model<IProduct>('Product', productSchema);

export interface IProductVariant extends Document {
  productId: Types.ObjectId;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  price: number;
  currency: string;
  status: ProductVariantStatus;
  weight?: number;
  dimensions?: Record<string, number>;
}

const variantSchema = new Schema<IProductVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    attributes: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: Object.values(ProductVariantStatus),
      default: ProductVariantStatus.ACTIVE,
    },
    weight: Number,
    dimensions: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const ProductVariant = mongoose.model<IProductVariant>('ProductVariant', variantSchema);

export interface IInventory extends Document {
  variantId: Types.ObjectId;
  partnerId: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  availableQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  status: InventoryStatus;
}

const inventorySchema = new Schema<IInventory>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone', sparse: true },
    availableQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    status: {
      type: String,
      enum: Object.values(InventoryStatus),
      default: InventoryStatus.IN_STOCK,
    },
  },
  { timestamps: true },
);

inventorySchema.index({ variantId: 1, partnerId: 1, serviceZoneId: 1 }, { unique: true });

export const Inventory = mongoose.model<IInventory>('Inventory', inventorySchema);

export interface IProductCompatibilityRule extends Document {
  productVariantId: Types.ObjectId;
  assetTypeId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  modelPattern?: string;
  conditions?: Record<string, unknown>;
  compatibilityLevel: CompatibilityLevel;
  reason: string;
  isActive: boolean;
}

const compatibilitySchema = new Schema<IProductCompatibilityRule>(
  {
    productVariantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    assetTypeId: { type: Schema.Types.ObjectId, ref: 'AssetType', index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    modelPattern: String,
    conditions: Schema.Types.Mixed,
    compatibilityLevel: {
      type: String,
      enum: Object.values(CompatibilityLevel),
      required: true,
    },
    reason: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProductCompatibilityRule = mongoose.model<IProductCompatibilityRule>(
  'ProductCompatibilityRule',
  compatibilitySchema,
);

export interface ISparePart extends Document {
  name: string;
  partNumber: string;
  brandId?: Types.ObjectId;
  compatibleAssetTypeIds: Types.ObjectId[];
  productVariantId?: Types.ObjectId;
  description?: string;
  status: SparePartStatus;
}

const sparePartSchema = new Schema<ISparePart>(
  {
    name: { type: String, required: true },
    partNumber: { type: String, required: true, unique: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    compatibleAssetTypeIds: [{ type: Schema.Types.ObjectId, ref: 'AssetType' }],
    productVariantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    description: String,
    status: { type: String, enum: Object.values(SparePartStatus), default: SparePartStatus.ACTIVE },
  },
  { timestamps: true },
);

export const SparePart = mongoose.model<ISparePart>('SparePart', sparePartSchema);

export interface IProductServiceBundle extends Document {
  name: string;
  productVariantId: Types.ObjectId;
  serviceId: Types.ObjectId;
  installationFee: number;
  isActive: boolean;
}

const bundleSchema = new Schema<IProductServiceBundle>(
  {
    name: { type: String, required: true },
    productVariantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    installationFee: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ProductServiceBundle = mongoose.model<IProductServiceBundle>(
  'ProductServiceBundle',
  bundleSchema,
);

export interface IMarketplaceCart extends Document {
  customerId: Types.ObjectId;
  items: Array<{
    variantId: Types.ObjectId;
    partnerId: Types.ObjectId;
    quantity: number;
    includeInstallation?: boolean;
  }>;
  serviceZoneId?: Types.ObjectId;
  addressId?: Types.ObjectId;
  updatedAt: Date;
}

const cartSchema = new Schema<IMarketplaceCart>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
        partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner' },
        quantity: { type: Number, min: 1 },
        includeInstallation: Boolean,
      },
    ],
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress' },
  },
  { timestamps: true },
);

export const MarketplaceCart = mongoose.model<IMarketplaceCart>('MarketplaceCart', cartSchema);

export interface IMarketplaceOrder extends Document {
  orderNumber: string;
  customerId: Types.ObjectId;
  addressId: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  status: MarketplaceOrderStatus;
  paymentStatus: PaymentStatus;
  paymentId?: Types.ObjectId;
  pricingSnapshot: Record<string, unknown>;
  deliverySnapshot?: Record<string, unknown>;
  idempotencyKey?: string;
  installationBookingId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IMarketplaceOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    addressId: { type: Schema.Types.ObjectId, ref: 'CustomerAddress', required: true },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    status: {
      type: String,
      enum: Object.values(MarketplaceOrderStatus),
      default: MarketplaceOrderStatus.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'MarketplacePayment' },
    pricingSnapshot: { type: Schema.Types.Mixed, required: true },
    deliverySnapshot: Schema.Types.Mixed,
    idempotencyKey: { type: String, sparse: true, unique: true },
    installationBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: true },
);

orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const MarketplaceOrder = mongoose.model<IMarketplaceOrder>('MarketplaceOrder', orderSchema);

export interface IOrderItem extends Document {
  orderId: Types.ObjectId;
  variantId: Types.ObjectId;
  partnerId: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productSnapshot: Record<string, unknown>;
  warrantySnapshot?: Record<string, unknown>;
  commissionSnapshot?: Record<string, unknown>;
  fulfillmentStatus: OrderFulfillmentStatus;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true, index: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    productSnapshot: { type: Schema.Types.Mixed, required: true },
    warrantySnapshot: Schema.Types.Mixed,
    commissionSnapshot: Schema.Types.Mixed,
    fulfillmentStatus: {
      type: String,
      enum: Object.values(OrderFulfillmentStatus),
      default: OrderFulfillmentStatus.PENDING,
    },
  },
  { timestamps: true },
);

export const OrderItem = mongoose.model<IOrderItem>('OrderItem', orderItemSchema);

export interface IOrderFulfillment extends Document {
  orderId: Types.ObjectId;
  partnerId: Types.ObjectId;
  status: OrderFulfillmentStatus;
  deliveryStatus: DeliveryStatus;
  trackingInfo?: Record<string, unknown>;
}

const fulfillmentSchema = new Schema<IOrderFulfillment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true },
    status: {
      type: String,
      enum: Object.values(OrderFulfillmentStatus),
      default: OrderFulfillmentStatus.PENDING,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.PROCESSING,
    },
    trackingInfo: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const OrderFulfillment = mongoose.model<IOrderFulfillment>('OrderFulfillment', fulfillmentSchema);

export interface IInventoryReservation extends Document {
  variantId: Types.ObjectId;
  partnerId: Types.ObjectId;
  customerId: Types.ObjectId;
  quantity: number;
  expiresAt: Date;
  status: 'ACTIVE' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  orderId?: Types.ObjectId;
}

const reservationSchema = new Schema<IInventoryReservation>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: { type: Number, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED'], default: 'ACTIVE' },
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder' },
  },
  { timestamps: true },
);

export const InventoryReservation = mongoose.model<IInventoryReservation>(
  'InventoryReservation',
  reservationSchema,
);

export interface IMarketplacePayment extends Document {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
}

const marketplacePaymentSchema = new Schema<IMarketplacePayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    provider: { type: String, default: 'razorpay' },
    providerOrderId: String,
    providerPaymentId: { type: String, sparse: true, unique: true },
    status: { type: String, enum: Object.values(PaymentStatus), required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const MarketplacePayment = mongoose.model<IMarketplacePayment>(
  'MarketplacePayment',
  marketplacePaymentSchema,
);

export interface IWarrantyRecord extends Document {
  customerId: Types.ObjectId;
  homeId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  orderItemId: Types.ObjectId;
  productId: Types.ObjectId;
  brandId?: Types.ObjectId;
  serialNumber?: string;
  purchaseDate: Date;
  warrantyStart: Date;
  warrantyEnd: Date;
  documentUrl?: string;
  status: MarketplaceWarrantyStatus;
}

const warrantyRecordSchema = new Schema<IWarrantyRecord>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home' },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset', index: true },
    orderItemId: { type: Schema.Types.ObjectId, ref: 'OrderItem', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand' },
    serialNumber: String,
    purchaseDate: { type: Date, required: true },
    warrantyStart: { type: Date, required: true },
    warrantyEnd: { type: Date, required: true, index: true },
    documentUrl: String,
    status: {
      type: String,
      enum: Object.values(MarketplaceWarrantyStatus),
      default: MarketplaceWarrantyStatus.ACTIVE,
    },
  },
  { timestamps: true },
);

export const WarrantyRecord = mongoose.model<IWarrantyRecord>('WarrantyRecord', warrantyRecordSchema);

export interface IReturnRequest extends Document {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  items: Array<{ orderItemId: Types.ObjectId; quantity: number }>;
  reason: string;
  description?: string;
  status: ReturnRequestStatus;
  resolution?: string;
  refundPaymentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const returnSchema = new Schema<IReturnRequest>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ orderItemId: { type: Schema.Types.ObjectId, ref: 'OrderItem' }, quantity: Number }],
    reason: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: Object.values(ReturnRequestStatus),
      default: ReturnRequestStatus.REQUESTED,
      index: true,
    },
    resolution: String,
    refundPaymentId: { type: Schema.Types.ObjectId, ref: 'MarketplacePayment' },
  },
  { timestamps: true },
);

export const ReturnRequest = mongoose.model<IReturnRequest>('ReturnRequest', returnSchema);

export interface IMarketplaceCommissionRule extends Document {
  partnerId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  productId?: Types.ObjectId;
  serviceZoneId?: Types.ObjectId;
  commissionType: CommissionType;
  value: number;
  fixedAmount?: number;
  isActive: boolean;
}

const commissionSchema = new Schema<IMarketplaceCommissionRule>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    serviceZoneId: { type: Schema.Types.ObjectId, ref: 'ServiceZone' },
    commissionType: { type: String, enum: Object.values(CommissionType), required: true },
    value: { type: Number, required: true },
    fixedAmount: Number,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const MarketplaceCommissionRule = mongoose.model<IMarketplaceCommissionRule>(
  'MarketplaceCommissionRule',
  commissionSchema,
);

export interface IPartnerSettlement extends Document {
  partnerId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  grossSales: number;
  commission: number;
  refunds: number;
  adjustments: number;
  netPayable: number;
  status: PartnerSettlementStatus;
  idempotencyKey?: string;
}

const settlementSchema = new Schema<IPartnerSettlement>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    grossSales: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    adjustments: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(PartnerSettlementStatus),
      default: PartnerSettlementStatus.DRAFT,
    },
    idempotencyKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
);

settlementSchema.index({ partnerId: 1, periodStart: 1, periodEnd: 1 });

export const PartnerSettlement = mongoose.model<IPartnerSettlement>(
  'PartnerSettlement',
  settlementSchema,
);

export interface IProductRecommendation extends Document {
  customerId: Types.ObjectId;
  homeId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  productId?: Types.ObjectId;
  variantId?: Types.ObjectId;
  source: ProductRecommendationSource;
  reason: string;
  confidence: number;
  bookingId?: Types.ObjectId;
  providerRecommendationId?: Types.ObjectId;
  isDismissed: boolean;
}

const recommendationSchema = new Schema<IProductRecommendation>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    homeId: { type: Schema.Types.ObjectId, ref: 'Home' },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    source: { type: String, enum: Object.values(ProductRecommendationSource), required: true },
    reason: { type: String, required: true },
    confidence: { type: Number, default: 0.7 },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    providerRecommendationId: { type: Schema.Types.ObjectId, ref: 'ProviderProductRecommendation' },
    isDismissed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ProductRecommendation = mongoose.model<IProductRecommendation>(
  'ProductRecommendation',
  recommendationSchema,
);

export interface IProviderProductRecommendation extends Document {
  providerId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  assetId?: Types.ObjectId;
  recommendationType: ProviderRecommendationType;
  categoryId?: Types.ObjectId;
  productId?: Types.ObjectId;
  variantId?: Types.ObjectId;
  sparePartId?: Types.ObjectId;
  diagnosisSummary: string;
  reason: string;
}

const providerRecSchema = new Schema<IProviderProductRecommendation>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'HomeAsset' },
    recommendationType: {
      type: String,
      enum: Object.values(ProviderRecommendationType),
      required: true,
    },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    sparePartId: { type: Schema.Types.ObjectId, ref: 'SparePart' },
    diagnosisSummary: { type: String, required: true },
    reason: { type: String, required: true },
  },
  { timestamps: true },
);

export const ProviderProductRecommendation = mongoose.model<IProviderProductRecommendation>(
  'ProviderProductRecommendation',
  providerRecSchema,
);

export interface IPartnerQualityScore extends Document {
  partnerId: Types.ObjectId;
  cancellationRate: number;
  lateShipmentRate: number;
  returnRate: number;
  customerRating: number;
  score: number;
  calculatedAt: Date;
}

const qualitySchema = new Schema<IPartnerQualityScore>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'MarketplacePartner', required: true, unique: true },
    cancellationRate: { type: Number, default: 0 },
    lateShipmentRate: { type: Number, default: 0 },
    returnRate: { type: Number, default: 0 },
    customerRating: { type: Number, default: 0 },
    score: { type: Number, default: 100 },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const PartnerQualityScore = mongoose.model<IPartnerQualityScore>(
  'PartnerQualityScore',
  qualitySchema,
);

export interface IMarketplaceRefund extends Document {
  orderId: Types.ObjectId;
  returnRequestId?: Types.ObjectId;
  paymentId: Types.ObjectId;
  amount: number;
  status: PaymentStatus;
  idempotencyKey: string;
  providerRefundId?: string;
}

const refundSchema = new Schema<IMarketplaceRefund>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'MarketplaceOrder', required: true },
    returnRequestId: { type: Schema.Types.ObjectId, ref: 'ReturnRequest' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'MarketplacePayment', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: Object.values(PaymentStatus), required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    providerRefundId: String,
  },
  { timestamps: true },
);

export const MarketplaceRefund = mongoose.model<IMarketplaceRefund>('MarketplaceRefund', refundSchema);
