import { Router } from 'express';
import * as authController from '@/modules/auth/auth.controller.js';
import { authenticate } from '@/middleware/auth.js';
import { otpLimiter } from '@/middleware/otpRateLimit.js';
import { mpinLoginLimiter } from '@/middleware/adminAuthRateLimit.js';
import { validateBody } from '@/middleware/validate.js';
import {
  mpinLoginSchema,
  refreshTokenSchema,
  registerRequestSchema,
  registerVerifySchema,
  resetMpinConfirmSchema,
  resetMpinRequestSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@/validators/auth.js';

const router = Router();

router.post(
  '/request-otp',
  otpLimiter,
  validateBody(requestOtpSchema),
  authController.requestOtp,
);

router.post(
  '/verify-otp',
  otpLimiter,
  validateBody(verifyOtpSchema),
  authController.verifyOtp,
);

router.post(
  '/register',
  otpLimiter,
  validateBody(registerRequestSchema),
  authController.registerRequestOtp,
);

router.post(
  '/register/verify',
  otpLimiter,
  validateBody(registerVerifySchema),
  authController.registerVerifyOtp,
);

router.post(
  '/login',
  mpinLoginLimiter,
  validateBody(mpinLoginSchema),
  authController.loginWithMpin,
);

router.get('/check-phone', otpLimiter, authController.checkPhone);

router.post(
  '/reset-mpin',
  otpLimiter,
  validateBody(resetMpinRequestSchema),
  authController.resetMpinRequestOtp,
);

router.post(
  '/reset-mpin/confirm',
  otpLimiter,
  validateBody(resetMpinConfirmSchema),
  authController.resetMpinConfirm,
);

router.post('/refresh-token', validateBody(refreshTokenSchema), authController.refreshToken);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);

export default router;
