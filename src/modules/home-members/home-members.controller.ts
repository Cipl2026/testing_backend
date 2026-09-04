import * as memberService from '@/modules/home-members/home-member.service.js';
import * as notificationPrefService from '@/modules/home-members/notification-preference.service.js';
import * as trustedContactService from '@/modules/home-members/trusted-contact.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listMembers = asyncHandler(async (req, res) => {
  const items = await memberService.listHomeMembers(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home members fetched successfully', { items });
});

export const inviteMember = asyncHandler(async (req, res) => {
  const data = await memberService.inviteHomeMember(req.auth!.userId, String(req.params.homeId), req.body);
  sendSuccess(res, 'Invitation sent successfully', data, 201);
});

export const updateMember = asyncHandler(async (req, res) => {
  const data = await memberService.updateHomeMember(
    req.auth!.userId,
    String(req.params.homeId),
    String(req.params.memberId),
    req.body,
  );
  sendSuccess(res, 'Member updated successfully', data);
});

export const removeMember = asyncHandler(async (req, res) => {
  const data = await memberService.removeHomeMember(
    req.auth!.userId,
    String(req.params.homeId),
    String(req.params.memberId),
  );
  sendSuccess(res, 'Member removed successfully', data);
});

export const listActivity = asyncHandler(async (req, res) => {
  const items = await memberService.listHomeMemberActivity(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home member activity fetched successfully', { items });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const data = await memberService.acceptHomeInvitation(
    req.auth!.userId,
    String(req.params.invitationId),
    req.body.token,
  );
  sendSuccess(res, 'Invitation accepted successfully', data);
});

export const listPendingInvitations = asyncHandler(async (req, res) => {
  const items = await memberService.listPendingInvitationsForUser(req.auth!.userId);
  sendSuccess(res, 'Pending invitations fetched successfully', { items });
});

export const rejectInvitation = asyncHandler(async (req, res) => {
  const data = await memberService.rejectHomeInvitation(req.auth!.userId, String(req.params.invitationId));
  sendSuccess(res, 'Invitation rejected successfully', data);
});

export const listTrustedContacts = asyncHandler(async (req, res) => {
  const items = await trustedContactService.listTrustedContacts(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Trusted contacts fetched successfully', { items });
});

export const createTrustedContact = asyncHandler(async (req, res) => {
  const data = await trustedContactService.createTrustedContact(
    req.auth!.userId,
    String(req.params.homeId),
    req.body,
  );
  sendSuccess(res, 'Trusted contact created successfully', data, 201);
});

export const updateTrustedContact = asyncHandler(async (req, res) => {
  const data = await trustedContactService.updateTrustedContact(
    req.auth!.userId,
    String(req.params.contactId),
    req.body,
  );
  sendSuccess(res, 'Trusted contact updated successfully', data);
});

export const deleteTrustedContact = asyncHandler(async (req, res) => {
  const data = await trustedContactService.deleteTrustedContact(
    req.auth!.userId,
    String(req.params.contactId),
  );
  sendSuccess(res, 'Trusted contact removed successfully', data);
});

export const listNotificationPreferences = asyncHandler(async (req, res) => {
  const items = await notificationPrefService.listNotificationPreferences(
    req.auth!.userId,
    String(req.params.homeId),
  );
  sendSuccess(res, 'Notification preferences fetched successfully', { items });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const items = await notificationPrefService.updateNotificationPreferences(
    req.auth!.userId,
    String(req.params.homeId),
    req.body.preferences,
  );
  sendSuccess(res, 'Notification preferences updated successfully', { items });
});
