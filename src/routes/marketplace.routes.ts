import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/marketplace/marketplace.controller.js';
import * as adminController from '@/modules/marketplace/marketplace-admin.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  addToCartBodySchema,
  compatibilityCheckBodySchema,
  createOrderBodySchema,
  createReturnBodySchema,
  orderIdParamSchema,
  partnerIdParamSchema,
  productSlugParamSchema,
  providerRecommendationBodySchema,
  upsertInventoryBodySchema,
  createProductBodySchema,
} from '@/validators/phase15.js';
import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';

const router = Router();

const fulfillmentParams = z.object({ partnerId: objectIdSchema, id: objectIdSchema });
const bookingParams = z.object({ bookingId: objectIdSchema });

router.get('/marketplace/products', controller.listProducts);
router.get(
  '/marketplace/products/:slug',
  validateParams(productSlugParamSchema),
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getProduct,
);
router.get(
  '/marketplace/recommendations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getRecommendations,
);

router.post(
  '/marketplace/compatibility/check',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(compatibilityCheckBodySchema),
  controller.checkCompatibility,
);

router.get(
  '/marketplace/cart',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.getCart,
);
router.post(
  '/marketplace/cart',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(addToCartBodySchema),
  controller.addToCart,
);

router.post(
  '/marketplace/orders',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(createOrderBodySchema),
  controller.createOrder,
);
router.get(
  '/marketplace/orders',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listOrders,
);
router.get(
  '/marketplace/orders/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orderIdParamSchema),
  controller.getOrder,
);

router.post(
  '/marketplace/returns',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(createReturnBodySchema),
  controller.createReturn,
);

router.get(
  '/warranties',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listWarranties,
);

router.post(
  '/provider/product-recommendations',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateBody(providerRecommendationBodySchema),
  adminController.providerCreateRecommendation,
);
router.get(
  '/provider/bookings/:bookingId/product-recommendations',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingParams),
  adminController.providerListRecommendations,
);

router.get(
  '/partner/:partnerId/products',
  authenticate,
  validateParams(partnerIdParamSchema),
  adminController.partnerListProducts,
);
router.post(
  '/partner/:partnerId/products',
  authenticate,
  validateParams(partnerIdParamSchema),
  validateBody(createProductBodySchema),
  adminController.partnerCreateProduct,
);
router.patch(
  '/partner/:partnerId/inventory',
  authenticate,
  validateParams(partnerIdParamSchema),
  validateBody(upsertInventoryBodySchema),
  adminController.partnerUpdateInventory,
);
router.get(
  '/partner/:partnerId/orders',
  authenticate,
  validateParams(partnerIdParamSchema),
  adminController.partnerListOrders,
);
router.patch(
  '/partner/:partnerId/fulfillment/:id',
  authenticate,
  validateParams(fulfillmentParams),
  adminController.partnerUpdateFulfillment,
);
router.get(
  '/partner/:partnerId/settlements',
  authenticate,
  validateParams(partnerIdParamSchema),
  adminController.partnerListSettlements,
);

export default router;
