import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  invoiceIdParamSchema,
  reviewIdParamSchema,
  ticketIdParamSchema,
  updateReviewBodySchema,
  createGeneralSupportTicketBodySchema,
  addSupportMessageBodySchema,
} from '@/validators/post-service.js';
import { paginationQuerySchema } from '@ghaarfix/validation';

const router = Router();

router.get(
  '/invoices',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(paginationQuerySchema),
  postServiceController.listCustomerInvoices,
);
router.get(
  '/invoices/:invoiceId',
  authenticate,
  postServiceController.getInvoice,
);
router.get(
  '/invoices/:invoiceId/download',
  authenticate,
  validateParams(invoiceIdParamSchema),
  postServiceController.downloadInvoice,
);

router.patch(
  '/reviews/:reviewId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(reviewIdParamSchema),
  validateBody(updateReviewBodySchema),
  postServiceController.updateReview,
);

router.get(
  '/support-tickets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(paginationQuerySchema),
  postServiceController.listSupportTickets,
);
router.get(
  '/support-tickets/chat',
  authenticate,
  authorize(UserRole.CUSTOMER),
  postServiceController.getOrCreateSupportChat,
);
router.post(
  '/support-tickets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(createGeneralSupportTicketBodySchema),
  postServiceController.createGeneralSupportTicket,
);
router.get(
  '/support-tickets/:ticketId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(ticketIdParamSchema),
  postServiceController.getSupportTicket,
);
router.post(
  '/support-tickets/:ticketId/messages',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(ticketIdParamSchema),
  validateBody(addSupportMessageBodySchema),
  postServiceController.addSupportMessage,
);

export default router;
