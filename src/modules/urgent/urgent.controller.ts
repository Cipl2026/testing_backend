import type { Request, Response } from 'express';
import * as urgentService from '@/modules/urgent/urgent.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const createUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const data = await urgentService.createUrgentRequest(
    req.auth!.userId,
    req.body,
    idempotencyKey,
  );
  sendSuccess(res, 'Urgent request created.', data, 201);
});

export const getUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentService.getUrgentRequest(req.auth!.userId, String(req.params.urgentRequestId));
  sendSuccess(res, 'Urgent request retrieved.', data);
});

export const getActiveUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentService.getActiveUrgentRequest(req.auth!.userId);
  sendSuccess(res, 'Active urgent request retrieved.', data);
});

export const cancelUrgentRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await urgentService.cancelUrgentRequest(
    req.auth!.userId,
    String(req.params.urgentRequestId),
    req.body.reason,
  );
  sendSuccess(res, 'Urgent request cancelled.', data);
});
