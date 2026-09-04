import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as addressController from '@/modules/addresses/address.controller.js';
import * as availabilityController from '@/modules/provider-availability/availability.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import { objectIdParamSchema } from '@/validators/catalog.js';
import {
  addressBodySchema,
  availabilityQuerySchema,
  providerDiscoveryQuerySchema,
  providerIdParamSchema,
  reservationIdParamSchema,
  slotReservationBodySchema,
} from '@/validators/availability.js';
import { serviceIdParamSchema } from '@/validators/catalog.js';

const router = Router();

router.get(
  '/addresses',
  authenticate,
  authorize(UserRole.CUSTOMER),
  addressController.listAddresses,
);
router.post(
  '/addresses',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(addressBodySchema),
  addressController.createAddress,
);
router.patch(
  '/addresses/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(objectIdParamSchema),
  validateBody(addressBodySchema.partial()),
  addressController.updateAddress,
);
router.delete(
  '/addresses/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(objectIdParamSchema),
  addressController.deleteAddress,
);
router.patch(
  '/addresses/:id/default',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(objectIdParamSchema),
  addressController.setDefaultAddress,
);

router.get(
  '/services/:serviceId/providers',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(serviceIdParamSchema),
  validateQuery(providerDiscoveryQuerySchema),
  availabilityController.discoverProviders,
);

router.get(
  '/providers/:providerId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(providerIdParamSchema),
  validateQuery(availabilityQuerySchema.pick({ serviceId: true, addressId: true })),
  availabilityController.getProviderPublicProfile,
);

router.get(
  '/providers/:providerId/availability',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(providerIdParamSchema),
  validateQuery(availabilityQuerySchema),
  availabilityController.getProviderAvailability,
);

router.post(
  '/availability/reservations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(slotReservationBodySchema),
  availabilityController.createReservation,
);
router.get(
  '/availability/reservations/:reservationId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(reservationIdParamSchema),
  availabilityController.getReservation,
);
router.delete(
  '/availability/reservations/:reservationId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(reservationIdParamSchema),
  availabilityController.releaseReservation,
);

export default router;
