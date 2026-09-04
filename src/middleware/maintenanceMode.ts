import type { Request, Response, NextFunction } from 'express';
import { MaintenanceMode } from '@ghaarfix/shared-types';
import { getMaintenanceMode, isRequestBlocked, isWriteBlocked } from '@/modules/reliability/maintenance-mode.service.js';
import { sendError } from '@/utils/apiResponse.js';
import { ErrorCode } from '@ghaarfix/shared-types';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path.startsWith('/health') || req.path.includes('/admin/login')) {
    next();
    return;
  }

  const { mode, message } = await getMaintenanceMode();

  if (isRequestBlocked(mode)) {
    sendError(
      res,
      message ?? 'Service is under maintenance. Please try again later.',
      ErrorCode.DEPENDENCY_FAILURE,
      503,
    );
    return;
  }

  if (WRITE_METHODS.has(req.method) && isWriteBlocked(mode)) {
    sendError(
      res,
      message ?? 'Service is in read-only maintenance mode.',
      ErrorCode.DEPENDENCY_FAILURE,
      503,
    );
    return;
  }

  if (mode === MaintenanceMode.LIMITED && req.path.includes('/campaigns')) {
    sendError(res, 'Campaign delivery paused during limited maintenance.', ErrorCode.DEPENDENCY_FAILURE, 503);
    return;
  }

  next();
}
