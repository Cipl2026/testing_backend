import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-health/home-health.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  createHomeBodySchema,
  createRoomBodySchema,
  createAssetBodySchema,
  homeIdParamSchema,
  updateHomeBodySchema,
} from '@/validators/home-health.js';
import homeMembersRoutes from '@/routes/home-members.routes.js';

const router = Router();

router.get('/', authenticate, authorize(UserRole.CUSTOMER), controller.listHomes);
router.post('/', authenticate, authorize(UserRole.CUSTOMER), validateBody(createHomeBodySchema), controller.createHome);
router.get('/:homeId', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.getHome);
router.patch('/:homeId', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(updateHomeBodySchema), controller.updateHome);
router.post('/:homeId/archive', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.archiveHome);
router.get('/:homeId/maintenance', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listMaintenance);
router.get('/:homeId/health', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.getHomeHealth);
router.get('/:homeId/insights', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.getHomeInsights);
router.get('/:homeId/rooms', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listRooms);
router.post('/:homeId/rooms', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(createRoomBodySchema), controller.createRoom);
router.get('/:homeId/assets', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listHomeAssets);
router.post('/:homeId/assets', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(createAssetBodySchema), controller.createAsset);

router.use('/:homeId', homeMembersRoutes);

export default router;
