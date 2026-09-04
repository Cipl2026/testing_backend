import * as sessionService from '@/modules/security/session.service.js';
import * as privacyService from '@/modules/security/privacy-consent.service.js';
import * as exportService from '@/modules/security/data-export.service.js';
import * as deletionService from '@/modules/security/account-deletion.service.js';
import * as stepUpService from '@/modules/security/step-up.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listUserSessions(req.auth!.userId);
  sendSuccess(res, 'Sessions fetched', { items: sessions });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const revoked = await sessionService.revokeSession(
    req.auth!.userId,
    String(req.params.id),
    'user_revoked',
  );
  if (!revoked) throw new AppError('Session not found', 404, ErrorCode.NOT_FOUND);
  sendSuccess(res, 'Session revoked', { revoked: true });
});

export const revokeOtherSessions = asyncHandler(async (req, res) => {
  const count = await sessionService.revokeOtherSessions(req.auth!.userId);
  sendSuccess(res, 'Other sessions revoked', { count });
});

export const getPrivacyConsent = asyncHandler(async (req, res) => {
  const data = await privacyService.getPrivacyConsents(req.auth!.userId);
  sendSuccess(res, 'Privacy consents fetched', data);
});

export const updatePrivacyConsent = asyncHandler(async (req, res) => {
  const data = await privacyService.updatePrivacyConsent(req.auth!.userId, req.body.consents);
  sendSuccess(res, 'Privacy consents updated', data);
});

export const requestDataExport = asyncHandler(async (req, res) => {
  const data = await exportService.requestDataExport(req.auth!.userId);
  sendSuccess(res, 'Data export requested', data, 202);
});

export const getDataExport = asyncHandler(async (req, res) => {
  const data = await exportService.getDataExport(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Data export fetched', data);
});

export const downloadDataExport = asyncHandler(async (req, res) => {
  const token = req.query.token as string;
  const data = await exportService.downloadDataExport(
    req.auth!.userId,
    String(req.params.id),
    token,
  );
  sendSuccess(res, 'Data export ready', data);
});

export const requestAccountDeletion = asyncHandler(async (req, res) => {
  const data = await deletionService.requestAccountDeletion(req.auth!.userId, req.body.reason);
  sendSuccess(res, 'Account deletion scheduled', data, 202);
});

export const getAccountDeletion = asyncHandler(async (req, res) => {
  const data = await deletionService.getAccountDeletionStatus(
    req.auth!.userId,
    req.params.id ? String(req.params.id) : undefined,
  );
  sendSuccess(res, 'Deletion status fetched', data);
});

export const initiateStepUp = asyncHandler(async (req, res) => {
  const data = await stepUpService.initiateStepUp(req.auth!.userId, req.body.action, req.body.method);
  sendSuccess(res, 'Step-up initiated', data);
});

export const verifyStepUp = asyncHandler(async (req, res) => {
  const verified = await stepUpService.verifyStepUpMpin(
    req.auth!.userId,
    req.body.stepUpId,
    req.body.mpin,
  );
  sendSuccess(res, 'Step-up verified', { verified });
});
