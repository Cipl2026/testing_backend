import type { Request, Response } from 'express';
import * as platformService from '@/modules/platform/admin-platform.service.js';
import * as broadcastService from '@/modules/platform/platform-broadcast.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await platformService.adminListAuditLogs(req.query as never);
  sendSuccess(res, 'Audit logs fetched successfully', { items: result.items }, 200, result.meta);
});

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const result = await platformService.adminListPlatformNotifications(req.query as never);
  sendSuccess(res, 'Notifications fetched successfully', { items: result.items }, 200, result.meta);
});

export const listDisputes = asyncHandler(async (req: Request, res: Response) => {
  const result = await platformService.adminListDisputes(req.query as never);
  sendSuccess(res, 'Disputes fetched successfully', { items: result.items }, 200, result.meta);
});

export const sendPlatformNotification = asyncHandler(async (req: Request, res: Response) => {
  const result = await broadcastService.sendPlatformBroadcast(req.auth!.userId, req.body);
  sendSuccess(res, 'Notification sent successfully', result);
});

export const sendTestPlatformNotification = asyncHandler(async (req: Request, res: Response) => {
  const result = await broadcastService.sendTestPlatformPush(req.auth!.userId, req.body);
  sendSuccess(res, 'Test notification sent successfully', result);
});
