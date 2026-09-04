import * as participantService from '@/modules/booking-participants/booking-participant.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listParticipants = asyncHandler(async (req, res) => {
  const data = await participantService.listBookingParticipants(
    req.auth!.userId,
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Booking participants fetched successfully', data);
});

export const addParticipant = asyncHandler(async (req, res) => {
  const data = await participantService.addBookingParticipant(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Participant added successfully', data, 201);
});

export const updateParticipant = asyncHandler(async (req, res) => {
  const data = await participantService.updateBookingParticipant(
    req.auth!.userId,
    String(req.params.bookingId),
    String(req.params.participantId),
    req.body,
  );
  sendSuccess(res, 'Participant updated successfully', data);
});

export const removeParticipant = asyncHandler(async (req, res) => {
  const data = await participantService.removeBookingParticipant(
    req.auth!.userId,
    String(req.params.bookingId),
    String(req.params.participantId),
  );
  sendSuccess(res, 'Participant removed successfully', data);
});

export const setGuestRecipient = asyncHandler(async (req, res) => {
  const data = await participantService.setGuestRecipient(
    req.auth!.userId,
    String(req.params.bookingId),
    req.body,
  );
  sendSuccess(res, 'Guest recipient saved successfully', data);
});
