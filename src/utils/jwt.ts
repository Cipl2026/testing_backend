import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserRole } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: UserRole;
  tokenType: 'refresh';
  jti: string;
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    role,
    tokenType: 'access',
  };
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string, role: UserRole, jti: string): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    role,
    tokenType: 'refresh',
    jti,
  };
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
    if (payload.tokenType !== 'access') {
      throw new AppError('Invalid token type.', 401, ErrorCode.UNAUTHORIZED);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired token.', 401, ErrorCode.UNAUTHORIZED);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
    if (payload.tokenType !== 'refresh') {
      throw new AppError('Invalid token type.', 401, ErrorCode.UNAUTHORIZED);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token.', 401, ErrorCode.UNAUTHORIZED);
  }
}
