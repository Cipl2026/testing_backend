import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-health/home-health.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  assetIdParamSchema,
  createWarrantyBodySchema,
  roomIdParamSchema,
  updateAssetBodySchema,
  warrantyIdParamSchema,
  createRoomBodySchema,
} from '@/validators/home-health.js';

const assetsRouter = Router();
assetsRouter.get('/:assetId', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), controller.getAsset);
assetsRouter.patch('/:assetId', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), validateBody(updateAssetBodySchema), controller.updateAsset);
assetsRouter.post('/:assetId/archive', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), controller.archiveAsset);
assetsRouter.get('/:assetId/history', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), controller.getAssetHistory);
assetsRouter.get('/:assetId/warranties', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), controller.listWarranties);
assetsRouter.post('/:assetId/warranties', authenticate, authorize(UserRole.CUSTOMER), validateParams(assetIdParamSchema), validateBody(createWarrantyBodySchema), controller.createWarranty);

const roomsRouter = Router();
roomsRouter.patch('/:roomId', authenticate, authorize(UserRole.CUSTOMER), validateParams(roomIdParamSchema), validateBody(createRoomBodySchema.partial()), controller.updateRoom);
roomsRouter.delete('/:roomId', authenticate, authorize(UserRole.CUSTOMER), validateParams(roomIdParamSchema), controller.deleteRoom);

const warrantiesRouter = Router();
warrantiesRouter.patch('/:warrantyId', authenticate, authorize(UserRole.CUSTOMER), validateParams(warrantyIdParamSchema), controller.updateWarranty);
warrantiesRouter.delete('/:warrantyId', authenticate, authorize(UserRole.CUSTOMER), validateParams(warrantyIdParamSchema), controller.deleteWarranty);

export { assetsRouter, roomsRouter, warrantiesRouter };
