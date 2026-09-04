import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/iot/iot.controller.js';
import * as adminController from '@/modules/iot/iot-admin.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  alertFeedbackBodySchema,
  approveDeviceBodySchema,
  connectProviderBodySchema,
  connectionDiscoverParamSchema,
  connectionIdParamSchema,
  deviceIdParamSchema,
  insightsQuerySchema,
  linkDeviceBodySchema,
  providerParamSchema,
} from '@/validators/phase16.js';

const router = Router();

router.get('/iot/connections', authenticate, authorize(UserRole.CUSTOMER), controller.listConnections);
router.post(
  '/iot/connections/:provider/connect',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(providerParamSchema),
  validateBody(connectProviderBodySchema),
  controller.connectProvider,
);
router.delete(
  '/iot/connections/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(connectionIdParamSchema),
  controller.disconnectConnection,
);
router.post(
  '/iot/connections/:connectionId/discover',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(connectionDiscoverParamSchema),
  controller.discoverDevices,
);

router.get('/iot/devices', authenticate, authorize(UserRole.CUSTOMER), controller.listDevices);
router.get(
  '/iot/devices/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  controller.getDevice,
);
router.post(
  '/iot/devices/:id/approve',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  validateBody(approveDeviceBodySchema),
  controller.approveDevice,
);
router.post(
  '/iot/devices/:id/link',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  validateBody(linkDeviceBodySchema),
  controller.linkDevice,
);
router.delete(
  '/iot/devices/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  controller.removeDevice,
);

router.get('/iot/alerts', authenticate, authorize(UserRole.CUSTOMER), controller.listAlerts);
router.post(
  '/iot/alerts/:id/acknowledge',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  controller.acknowledgeAlert,
);
router.post(
  '/iot/alerts/:id/feedback',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(deviceIdParamSchema),
  validateBody(alertFeedbackBodySchema),
  controller.alertFeedback,
);

router.get(
  '/iot/insights',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(insightsQuerySchema),
  controller.getInsights,
);

router.post('/iot/webhooks/:connectionId', adminController.webhookIngest);

router.get(
  '/organizations/:id/iot/devices',
  authenticate,
  authorize(UserRole.CUSTOMER),
  adminController.orgListDevices,
);
router.get(
  '/organizations/:id/iot/alerts',
  authenticate,
  authorize(UserRole.CUSTOMER),
  adminController.orgListAlerts,
);

export default router;
