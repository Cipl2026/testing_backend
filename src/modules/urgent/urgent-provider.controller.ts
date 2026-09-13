import type { Request, Response } from 'express';
import * as urgentProviderService from '@/modules/urgent/urgent-provider.service.js';
import * as presenceService from '@/modules/presence/presence.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listProviderUrgentRequests = asyncHandler(async (req: Request, res: Response) => {
  const items = await urgentProviderService.listProviderUrgentRequests(req.auth!.userId);
  sendSuccess(res, 'Urgent requests retrieved.', { items });
});

export const getProviderUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentProviderService.getProviderUrgentRequest(
    req.auth!.userId,
    String(req.params.urgentRequestId),
  );
  sendSuccess(res, 'Urgent request retrieved.', data);
});

export const acceptUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentProviderService.acceptUrgentRequest(
    req.auth!.userId,
    String(req.params.urgentRequestId),
  );
  sendSuccess(res, 'Urgent request accepted.', data);
});

export const rejectUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentProviderService.rejectUrgentRequest(
    req.auth!.userId,
    String(req.params.urgentRequestId),
    req.body.reason,
  );
  sendSuccess(res, 'Urgent request rejected.', data);
});

export const setOnline = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.setProviderOnline(req.auth!.userId);
  sendSuccess(res, 'You are now online.', data);
});

export const setOffline = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.setProviderOffline(req.auth!.userId);
  sendSuccess(res, 'You are now offline.', data);
});

export const setBusy = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.setProviderBusy(req.auth!.userId);
  sendSuccess(res, 'You are now busy.', data);
});

export const heartbeat = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.heartbeatProvider(req.auth!.userId, req.body);
  sendSuccess(res, 'Presence updated.', data);
});

export const registerPushToken = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.registerPushToken(
    req.auth!.userId,
    req.body.token,
    req.body.platform,
    req.body.deviceId,
  );
  sendSuccess(res, 'Push token registered.', data);
});

export const getPresence = asyncHandler(async (req: Request, res: Response) => {
  const data = await presenceService.getProviderPresence(req.auth!.userId);
  sendSuccess(res, 'Presence retrieved.', data);
});
