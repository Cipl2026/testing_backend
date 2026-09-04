import type { Request, Response } from 'express';
import * as notificationService from '@/modules/notifications/notification.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 30);
  const result = await notificationService.listNotifications(req.auth!.userId, page, limit);
  sendSuccess(
    res,
    'Notifications fetched successfully',
    { items: result.items, unreadCount: result.unreadCount },
    200,
    result.meta,
  );
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.markNotificationRead(
    req.auth!.userId,
    String(req.params.id),
  );
  sendSuccess(res, 'Notification marked as read', { notification: data });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const data = await notificationService.markAllNotificationsRead(req.auth!.userId);
  sendSuccess(res, 'All notifications marked as read', data);
});

export const markReadBatch = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  const data = await notificationService.markNotificationsReadBatch(req.auth!.userId, ids);
  sendSuccess(res, 'Notifications marked as read', data);
});

export const clearNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body as { ids?: string[] };
  const data = await notificationService.clearNotifications(req.auth!.userId, ids);
  sendSuccess(res, 'Notifications cleared', data);
});
