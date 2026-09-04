import {
  CompatibilityLevel,
  ErrorCode,
  MarketplacePartnerStatus,
  ProductApprovalStatus,
  ProductStatus,
} from '@ghaarfix/shared-types';
import {
  Brand,
  Inventory,
  Product,
  ProductVariant,
} from '@/models/Marketplace.js';
import { checkCompatibility } from '@/modules/marketplace/compatibility.service.js';
import { AppError } from '@/utils/AppError.js';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listProducts(query: {
  search?: string;
  categoryId?: string;
  brandId?: string;
  serviceZoneId?: string;
  page?: number;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {
    status: ProductStatus.ACTIVE,
    approvalStatus: ProductApprovalStatus.APPROVED,
  };
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.brandId) filter.brandId = query.brandId;
  if (query.search) filter.name = new RegExp(query.search, 'i');

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('brandId', 'name slug verificationStatus'),
    Product.countDocuments(filter),
  ]);

  return {
    items: await Promise.all(items.map((p) => serializeProductListItem(p))),
    meta: { page, limit, total },
  };
}

async function serializeProductListItem(product: InstanceType<typeof Product>) {
  const variant = await ProductVariant.findOne({
    productId: product._id,
    status: 'ACTIVE',
  }).sort({ price: 1 });

  const brand = product.brandId as unknown as { name?: string; verificationStatus?: string };

  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    brandName: brand?.name,
    brandVerification: brand?.verificationStatus,
    startingPrice: variant?.price,
    media: product.media[0],
    isInstallable: product.isInstallable,
    requiresProfessionalInstallation: product.requiresProfessionalInstallation,
  };
}

export async function getProductBySlug(
  slug: string,
  options?: { customerId?: string; assetId?: string },
) {
  const product = await Product.findOne({
    slug,
    status: ProductStatus.ACTIVE,
    approvalStatus: ProductApprovalStatus.APPROVED,
  }).populate('brandId');

  if (!product) throw new AppError('Product not found.', 404, ErrorCode.NOT_FOUND);

  const variants = await ProductVariant.find({ productId: product._id, status: 'ACTIVE' });
  const brand = product.brandId as unknown as InstanceType<typeof Brand>;

  const variantsWithStock = await Promise.all(
    variants.map(async (v) => {
      const inv = await Inventory.findOne({ variantId: v._id });
      let compatibility;
      if (options?.customerId && options.assetId) {
        compatibility = await checkCompatibility({
          customerId: options.customerId,
          variantId: v._id.toString(),
          assetId: options.assetId,
        });
      }
      return {
        id: v._id.toString(),
        sku: v.sku,
        name: v.name,
        price: v.price,
        currency: v.currency,
        attributes: v.attributes,
        inStock: (inv?.availableQuantity ?? 0) - (inv?.reservedQuantity ?? 0) > 0,
        compatibility,
      };
    }),
  );

  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: brand
      ? {
          id: brand._id.toString(),
          name: brand.name,
          verificationStatus: brand.verificationStatus,
        }
      : undefined,
    media: product.media,
    attributes: product.attributes,
    isInstallable: product.isInstallable,
    requiresProfessionalInstallation: product.requiresProfessionalInstallation,
    warrantyConfig: product.warrantyConfig,
    returnPolicyDays: product.returnPolicyDays,
    variants: variantsWithStock,
  };
}

export async function createProduct(
  partnerId: string,
  input: {
    name: string;
    brandId: string;
    categoryId?: string;
    description?: string;
    isInstallable?: boolean;
    requiresProfessionalInstallation?: boolean;
    warrantyConfig?: Record<string, unknown>;
    returnPolicyDays?: number;
    variants: Array<{ sku: string; name: string; price: number; attributes?: Record<string, unknown> }>;
  },
  options?: { trustedPublisher?: boolean },
) {
  const slug = slugify(input.name);
  const product = await Product.create({
    name: input.name,
    slug: `${slug}-${Date.now().toString(36)}`,
    brandId: input.brandId,
    categoryId: input.categoryId,
    partnerId,
    description: input.description,
    status: ProductStatus.DRAFT,
    approvalStatus: options?.trustedPublisher
      ? ProductApprovalStatus.APPROVED
      : ProductApprovalStatus.PENDING_REVIEW,
    isInstallable: input.isInstallable ?? false,
    requiresProfessionalInstallation: input.requiresProfessionalInstallation ?? false,
    warrantyConfig: input.warrantyConfig,
    returnPolicyDays: input.returnPolicyDays ?? 7,
  });

  if (options?.trustedPublisher) {
    product.status = ProductStatus.ACTIVE;
    await product.save();
  }

  for (const v of input.variants) {
    await ProductVariant.create({
      productId: product._id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      attributes: v.attributes ?? {},
    });
  }

  return { id: product._id.toString(), approvalStatus: product.approvalStatus };
}

export async function approveProduct(productId: string) {
  const product = await Product.findByIdAndUpdate(
    productId,
    {
      approvalStatus: ProductApprovalStatus.APPROVED,
      status: ProductStatus.ACTIVE,
    },
    { new: true },
  );
  if (!product) throw new AppError('Product not found.', 404, ErrorCode.NOT_FOUND);
  return product;
}

export async function blockIncompatiblePurchase(
  customerId: string,
  variantId: string,
  assetId?: string,
) {
  if (!assetId) return;
  const check = await checkCompatibility({ customerId, variantId, assetId });
  if (check.level === CompatibilityLevel.INCOMPATIBLE) {
    throw new AppError(
      `Not compatible: ${check.reason}`,
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export async function assertPartnerCanSell(partnerId: string) {
  const { MarketplacePartner } = await import('@/models/Marketplace.js');
  const partner = await MarketplacePartner.findById(partnerId);
  if (!partner || partner.status !== MarketplacePartnerStatus.ACTIVE) {
    throw new AppError('Seller not available.', 403, ErrorCode.FORBIDDEN);
  }
}
