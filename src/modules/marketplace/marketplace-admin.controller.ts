import * as catalogService from '@/modules/marketplace/catalog.service.js';
import * as inventoryService from '@/modules/marketplace/inventory.service.js';
import * as settlementService from '@/modules/marketplace/settlement.service.js';
import * as returnService from '@/modules/marketplace/return.service.js';
import * as providerRecService from '@/modules/marketplace/provider-recommendation.service.js';
import { assertPartnerAccess } from '@/modules/marketplace/partner-authorization.service.js';
import {
  Brand,
  MarketplaceOrder,
  MarketplacePartner,
  OrderFulfillment,
  Product,
  ProductCompatibilityRule,
  MarketplaceCommissionRule,
} from '@/models/Marketplace.js';
import { OrderItem } from '@/models/Marketplace.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const adminListProducts = asyncHandler(async (_req, res) => {
  const items = await Product.find().sort({ createdAt: -1 }).limit(100);
  sendSuccess(res, 'Products fetched', {
    items: items.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      status: p.status,
      approvalStatus: p.approvalStatus,
      partnerId: p.partnerId.toString(),
    })),
  });
});

export const adminApproveProduct = asyncHandler(async (req, res) => {
  const product = await catalogService.approveProduct(String(req.params.id));
  sendSuccess(res, 'Product approved', { id: product._id.toString() });
});

export const adminListBrands = asyncHandler(async (_req, res) => {
  const items = await Brand.find().sort({ name: 1 });
  sendSuccess(res, 'Brands fetched', { items });
});

export const adminCreateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.create(req.body);
  sendSuccess(res, 'Brand created', { id: brand._id.toString() }, 201);
});

export const adminListPartners = asyncHandler(async (_req, res) => {
  const items = await MarketplacePartner.find().sort({ createdAt: -1 });
  sendSuccess(res, 'Partners fetched', { items });
});

export const adminApprovePartner = asyncHandler(async (req, res) => {
  const partner = await MarketplacePartner.findByIdAndUpdate(
    req.params.id,
    { status: 'ACTIVE' },
    { new: true },
  );
  sendSuccess(res, 'Partner approved', partner);
});

export const adminListOrders = asyncHandler(async (_req, res) => {
  const items = await MarketplaceOrder.find().sort({ createdAt: -1 }).limit(100);
  sendSuccess(res, 'Orders fetched', { items });
});

export const adminListReturns = asyncHandler(async (req, res) => {
  const items = await returnService.listReturns({ status: req.query.status as string });
  sendSuccess(res, 'Returns fetched', { items });
});

export const adminListCompatibilityRules = asyncHandler(async (_req, res) => {
  const items = await ProductCompatibilityRule.find({ isActive: true }).limit(100);
  sendSuccess(res, 'Rules fetched', { items });
});

export const adminCreateCompatibilityRule = asyncHandler(async (req, res) => {
  const rule = await ProductCompatibilityRule.create(req.body);
  sendSuccess(res, 'Rule created', { id: rule._id.toString() }, 201);
});

export const adminListCommissionRules = asyncHandler(async (_req, res) => {
  const items = await MarketplaceCommissionRule.find({ isActive: true });
  sendSuccess(res, 'Commission rules fetched', { items });
});

export const adminCreateCommissionRule = asyncHandler(async (req, res) => {
  const rule = await MarketplaceCommissionRule.create(req.body);
  sendSuccess(res, 'Commission rule created', { id: rule._id.toString() }, 201);
});

export const adminAnalytics = asyncHandler(async (_req, res) => {
  const [orderCount, gmv, productCount, partnerCount] = await Promise.all([
    MarketplaceOrder.countDocuments(),
    MarketplaceOrder.aggregate([{ $group: { _id: null, total: { $sum: '$pricingSnapshot.finalAmount' } } }]),
    Product.countDocuments({ status: 'ACTIVE' }),
    MarketplacePartner.countDocuments({ status: 'ACTIVE' }),
  ]);
  sendSuccess(res, 'Marketplace analytics', {
    orderCount,
    gmv: gmv[0]?.total ?? 0,
    activeProducts: productCount,
    activePartners: partnerCount,
  });
});

export const partnerListProducts = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  await assertPartnerAccess(partnerId, req.auth!.userId, 'products');
  const items = await Product.find({ partnerId }).sort({ createdAt: -1 });
  sendSuccess(res, 'Partner products', { items });
});

export const partnerCreateProduct = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  const { partner } = await assertPartnerAccess(partnerId, req.auth!.userId, 'products');
  const result = await catalogService.createProduct(partnerId, req.body, {
    trustedPublisher: partner.isTrustedPublisher,
  });
  sendSuccess(res, 'Product submitted', result, 201);
});

export const partnerUpdateInventory = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  await assertPartnerAccess(partnerId, req.auth!.userId, 'inventory');
  const inv = await inventoryService.upsertInventory(partnerId, req.body);
  sendSuccess(res, 'Inventory updated', inv);
});

export const partnerListOrders = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  await assertPartnerAccess(partnerId, req.auth!.userId, 'orders');
  const items = await OrderItem.find({ partnerId }).sort({ createdAt: -1 }).limit(50);
  sendSuccess(res, 'Partner orders', { items });
});

export const partnerUpdateFulfillment = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  await assertPartnerAccess(partnerId, req.auth!.userId, 'fulfillment');
  const fulfillment = await OrderFulfillment.findOneAndUpdate(
    { _id: req.params.id, partnerId },
    req.body,
    { new: true },
  );
  sendSuccess(res, 'Fulfillment updated', fulfillment);
});

export const partnerListSettlements = asyncHandler(async (req, res) => {
  const partnerId = String(req.params.partnerId);
  await assertPartnerAccess(partnerId, req.auth!.userId, 'settlements');
  const items = await settlementService.listPartnerSettlements(partnerId);
  sendSuccess(res, 'Settlements fetched', { items });
});

export const providerCreateRecommendation = asyncHandler(async (req, res) => {
  const result = await providerRecService.createProviderRecommendation(req.auth!.userId, req.body);
  sendSuccess(res, 'Recommendation created', result, 201);
});

export const providerListRecommendations = asyncHandler(async (req, res) => {
  const items = await providerRecService.getProviderRecommendationsForBooking(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Recommendations fetched', { items });
});
