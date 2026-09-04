import type { NextFunction, Request, Response } from 'express';
import { UserRole, ErrorCode } from '@ghaarfix/shared-types';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { verifyAccessToken } from '@/utils/jwt.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new AppError('Authentication required.', 401, ErrorCode.UNAUTHORIZED));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) {
      next(new AppError('Authentication required.', 401, ErrorCode.UNAUTHORIZED));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(new AppError('You do not have permission to access this resource.', 403, ErrorCode.FORBIDDEN));
      return;
    }

    const user = await User.findById(req.auth.userId);
    if (!user) {
      next(new AppError('User not found.', 401, ErrorCode.UNAUTHORIZED));
      return;
    }

    if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
      next(new AppError('Account suspended.', 403, ErrorCode.FORBIDDEN));
      return;
    }

    next();
  };
}
