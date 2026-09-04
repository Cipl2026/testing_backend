import type { Request, Response } from 'express';
import * as adminService from '@/modules/auth/admin.service.js';
import * as dashboardService from '@/modules/auth/admin-dashboard.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.adminLogin(req.body);
  sendSuccess(res, 'Admin login successful', result);
});

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await dashboardService.getDashboardOverview();
  sendSuccess(res, 'Dashboard fetched successfully', overview);
});
