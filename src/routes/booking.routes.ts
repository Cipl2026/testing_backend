import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as bookingController from '@/modules/bookings/booking.controller.js';
import { bookingRateLimit } from '@/middleware/bookingRateLimit.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import {
  bookingIdParamSchema,
  bookingListQuerySchema,
  bookingMessageIdParamSchema,
  bookingMessagesQuerySchema,
  addBookingMessageBodySchema,
  cancelBookingBodySchema,
  createBookingBodySchema,
  findAnotherProviderBodySchema,
  priceChangeResponseBodySchema,
  rescheduleResponseBodySchema,
} from '@/validators/booking.js';
import * as participantController from '@/modules/booking-participants/booking-participant.controller.js';
import {
  addParticipantBodySchema,
  guestRecipientBodySchema,
  participantIdParamSchema,
  updateParticipantBodySchema,
} from '@/validators/phase9.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER),
  bookingRateLimit,
  validateBody(createBookingBodySchema),
  bookingController.createBooking,
);
router.get(
  '/',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateQuery(bookingListQuerySchema),
  bookingController.listBookings,
);
router.get(
  '/:bookingId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  bookingController.getBooking,
);
router.post(
  '/:bookingId/cancel',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(cancelBookingBodySchema),
  bookingController.cancelBooking,
);
router.post(
  '/:bookingId/no-show',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(cancelBookingBodySchema),
  bookingController.reportNoShow,
);
router.post(
  '/:bookingId/reschedule-response',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(rescheduleResponseBodySchema),
  bookingController.respondReschedule,
);
router.post(
  '/:bookingId/price-change-response',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(priceChangeResponseBodySchema),
  bookingController.respondPriceChange,
);
router.post(
  '/:bookingId/wait-for-provider',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  bookingController.waitForProvider,
);
router.post(
  '/:bookingId/find-another-provider',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(findAnotherProviderBodySchema),
  bookingController.findAnotherProvider,
);
router.post(
  '/:bookingId/request-replacement',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  bookingController.requestReplacement,
);

router.get(
  '/:bookingId/participants',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  participantController.listParticipants,
);
router.post(
  '/:bookingId/participants',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(addParticipantBodySchema),
  participantController.addParticipant,
);
router.patch(
  '/:bookingId/participants/:participantId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(participantIdParamSchema),
  validateBody(updateParticipantBodySchema),
  participantController.updateParticipant,
);
router.delete(
  '/:bookingId/participants/:participantId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(participantIdParamSchema),
  participantController.removeParticipant,
);
router.post(
  '/:bookingId/guest-recipient',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(guestRecipientBodySchema),
  participantController.setGuestRecipient,
);

router.get(
  '/:bookingId/messages',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateQuery(bookingMessagesQuerySchema),
  bookingController.listBookingMessages,
);
router.post(
  '/:bookingId/messages',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingIdParamSchema),
  validateBody(addBookingMessageBodySchema),
  bookingController.sendBookingMessage,
);
router.delete(
  '/:bookingId/messages/:messageId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bookingMessageIdParamSchema),
  bookingController.unsendBookingMessage,
);

export default router;
