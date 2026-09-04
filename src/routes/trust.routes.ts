import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as customerController from '@/modules/trust-protection/trust-customer.controller.js';
import * as providerController from '@/modules/trust-protection/trust-provider.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { uploadMiddleware } from '@/middleware/upload.js';
import {
  bookingIdParamSchema,
  claimIdParamSchema,
  claimEvidenceBodySchema,
  checklistBodySchema,
  createClaimBodySchema,
  partApprovalBodySchema,
  partIdParamSchema,
  claimResponseBodySchema,
  revisitBodySchema,
  providerTrustParamSchema,
} from '@/validators/phase18.js';

const router = Router();

router.get(
  '/bookings/:bookingId/guarantee',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  customerController.getBookingGuarantee,
);

router.post(
  '/bookings/:bookingId/claims',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(createClaimBodySchema),
  customerController.createClaim,
);

router.get('/claims', authenticate, authorize(UserRole.CUSTOMER), customerController.listClaims);

router.get(
  '/claims/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(claimIdParamSchema),
  customerController.getClaim,
);

router.post(
  '/claims/:id/evidence',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(claimIdParamSchema),
  validateBody(claimEvidenceBodySchema),
  customerController.addClaimEvidence,
);

router.post(
  '/bookings/:bookingId/revisit',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(revisitBodySchema),
  customerController.requestRevisit,
);

router.post(
  '/parts/:id/approve',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(partIdParamSchema),
  customerController.approvePart,
);

router.post(
  '/parts/:id/reject',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(partIdParamSchema),
  customerController.rejectPart,
);

router.get(
  '/providers/:providerId/trust',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(providerTrustParamSchema),
  customerController.getProviderTrust,
);

router.post(
  '/provider/bookings/:bookingId/evidence',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  uploadMiddleware.single('file'),
  providerController.uploadEvidence,
);

router.post(
  '/provider/bookings/:bookingId/checklist',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(checklistBodySchema),
  providerController.submitChecklist,
);

router.post(
  '/provider/bookings/:bookingId/parts',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  validateBody(partApprovalBodySchema),
  providerController.requestPartApproval,
);

router.get(
  '/provider/bookings/:bookingId/parts',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(bookingIdParamSchema),
  providerController.listPartApprovals,
);

router.get('/provider/quality', authenticate, authorize(UserRole.PROVIDER), providerController.getQuality);

router.get(
  '/provider/improvement-plan',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerController.getImprovementPlan,
);

router.get(
  '/provider/certifications',
  authenticate,
  authorize(UserRole.PROVIDER),
  providerController.getCertifications,
);

router.post(
  '/provider/claims/:id/respond',
  authenticate,
  authorize(UserRole.PROVIDER),
  validateParams(claimIdParamSchema),
  validateBody(claimResponseBodySchema),
  providerController.respondToClaim,
);

export default router;
