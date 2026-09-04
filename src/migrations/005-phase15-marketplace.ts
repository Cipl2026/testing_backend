import {
  Brand,
  MarketplaceCommissionRule,
  MarketplacePartner,
  Product,
  ProductVariant,
  Inventory,
} from '@/models/Marketplace.js';
import { BrandVerificationStatus, CommissionType, MarketplacePartnerStatus, MarketplacePartnerType, ProductApprovalStatus, ProductStatus } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

export async function runPhase15Migrations() {
  await Promise.all([
    Brand.syncIndexes(),
    MarketplacePartner.syncIndexes(),
    Product.syncIndexes(),
    ProductVariant.syncIndexes(),
    Inventory.syncIndexes(),
  ]);

  const partnerCount = await MarketplacePartner.countDocuments();
  if (partnerCount === 0) {
    const brand = await Brand.create({
      name: 'Kent RO',
      slug: 'kent-ro',
      verificationStatus: BrandVerificationStatus.OFFICIAL_PARTNER,
      status: 'ACTIVE',
    });

    const partner = await MarketplacePartner.create({
      name: 'GhaarFix Authorized Store',
      slug: 'ghaarfix-store',
      type: MarketplacePartnerType.AUTHORIZED_SELLER,
      status: MarketplacePartnerStatus.ACTIVE,
      businessDetails: { gstin: 'SEED' },
      isTrustedPublisher: false,
    });

    const product = await Product.create({
      name: 'Kent Grand Plus RO Water Purifier',
      slug: 'kent-grand-plus-ro',
      brandId: brand._id,
      partnerId: partner._id,
      description: '8L RO water purifier with UV UF technology.',
      status: ProductStatus.ACTIVE,
      approvalStatus: ProductApprovalStatus.APPROVED,
      isInstallable: true,
      requiresProfessionalInstallation: true,
      warrantyConfig: { months: 12 },
      returnPolicyDays: 7,
      media: [],
    });

    const variant = await ProductVariant.create({
      productId: product._id,
      sku: 'KENT-GRAND-PLUS-001',
      name: 'Standard',
      price: 18999,
      currency: 'INR',
    });

    await Inventory.create({
      variantId: variant._id,
      partnerId: partner._id,
      availableQuantity: 50,
      reservedQuantity: 0,
      reorderLevel: 5,
      status: 'IN_STOCK',
    });

    await MarketplaceCommissionRule.create({
      partnerId: partner._id,
      commissionType: CommissionType.PERCENTAGE,
      value: 10,
      isActive: true,
    });

    logger.info('Phase 15 marketplace seed data created');
  }

  logger.info('Phase 15 marketplace indexes ensured');
}
