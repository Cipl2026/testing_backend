import type { Request, Response } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as authService from '@/modules/auth/auth.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.requestOtp(req.body);
  sendSuccess(res, 'OTP sent successfully', result);
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifyOtp(req.body);
  sendSuccess(res, 'Authentication successful', result);
});

export const registerRequestOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerRequestOtp(req.body);
  sendSuccess(res, 'OTP sent successfully', result);
});

export const registerVerifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerVerifyOtp(req.body);
  sendSuccess(res, 'Account created successfully', result);
});

export const registerResendOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerResendOtp(req.body);
  sendSuccess(res, 'OTP resent successfully', result);
});

export const loginWithMpin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginWithMpin(req.body);
  sendSuccess(res, 'Login successful', result);
});

export const checkPhone = asyncHandler(async (req: Request, res: Response) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
  const roleParam = typeof req.query.role === 'string' ? req.query.role : UserRole.CUSTOMER;
  const role =
    roleParam === UserRole.PROVIDER ? UserRole.PROVIDER : UserRole.CUSTOMER;
  const result = await authService.checkPhoneRegistered(phone, role);
  sendSuccess(res, 'Phone status fetched', result);
});

export const resetMpinRequestOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetMpinRequestOtp(req.body);
  sendSuccess(res, 'OTP sent successfully', result);
});

export const resetMpinConfirm = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetMpinConfirm(req.body);
  sendSuccess(res, 'MPIN updated successfully', result);
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.refreshTokens(req.body.refreshToken);
  sendSuccess(res, 'Token refreshed successfully', tokens);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  if (userId) {
    await authService.logout(userId, req.body.refreshToken);
  }
  sendSuccess(res, 'Logged out successfully', null);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.auth!.userId);
  sendSuccess(res, 'User fetched successfully', { user });
});
