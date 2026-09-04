import type { Request, Response } from 'express';
import * as urgentAdminService from '@/modules/urgent/urgent-admin.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listUrgentRequests = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  };
  const result = await urgentAdminService.adminListUrgentRequests(query);
  sendSuccess(res, 'Urgent requests retrieved.', { items: result.items }, 200, result.meta);
});

export const getUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentAdminService.adminGetUrgentRequest(String(req.params.urgentRequestId));
  sendSuccess(res, 'Urgent request retrieved.', data);
});

export const cancelUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentAdminService.adminCancelUrgentRequest(
    req.auth!.userId,
    String(req.params.urgentRequestId),
    req.body.reason,
  );
  sendSuccess(res, 'Urgent request cancelled.', data);
});
