import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserRole, ProviderStatus, ErrorCode } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { CustomerProfile, type ICustomerProfile } from '@/models/CustomerProfile.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { RegistrationIntent } from '@/models/RegistrationIntent.js';
import { RefreshToken } from '@/models/RefreshToken.js';
import { User } from '@/models/User.js';
import { getOtpProvider } from '@/modules/auth/otp/otpProviderFactory.js';
import { AppError } from '@/utils/AppError.js';
import { generateOtp, generateRequestId, hashOtp, hashToken, verifyOtpHash } from '@/utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt.js';
import { logger } from '@/utils/logger.js';
import { normalizePhone } from '@/utils/phone.js';
import { serializeCustomerUser, serializeUser } from '@/utils/serializers.js';
import {
  createSession,
  handleTokenReuse,
  touchSession,
  type SessionContext,
} from '@/modules/security/session.service.js';
import { recordAuthFailure } from '@/modules/security/security-event.service.js';
import { isSecurityComplianceEnabled } from '@/modules/security/security-feature.service.js';
import type {
  MpinLoginInput,
  RegisterRequestInput,
  RegisterVerifyInput,
  RequestOtpInput,
  ResetMpinConfirmInput,
  ResetMpinRequestInput,
  VerifyOtpInput,
} from '@/validators/auth.js';

async function validateAndConsumeOtp(
  phone: string,
  role: UserRole.CUSTOMER | UserRole.PROVIDER,
  otpCode: string,
): Promise<void> {
  const otpRecord = await Otp.findOne({
    phone,
    role,
    isVerified: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError('OTP expired or not found. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    otpRecord.isVerified = true;
    await otpRecord.save();
    throw new AppError('OTP has expired. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.attempts >= env.otp.maxAttempts) {
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429, ErrorCode.TOO_MANY_REQUESTS);
  }

  if (!verifyOtpHash(otpCode, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new AppError('Incorrect OTP. Please try again.', 400, ErrorCode.VALIDATION_ERROR);
  }

  otpRecord.isVerified = true;
  await otpRecord.save();
}

export async function requestOtp(input: RequestOtpInput): Promise<{ requestId: string; otp?: string }> {
  const phone = normalizePhone(input.phone);
  const role = input.role as UserRole.CUSTOMER | UserRole.PROVIDER;

  const recentOtp = await Otp.findOne({
    phone,
    role,
    isVerified: false,
    lastSentAt: { $gte: new Date(Date.now() - env.otp.resendCooldownSeconds * 1000) },
  }).sort({ createdAt: -1 });

  if (recentOtp) {
    throw new AppError(
      `Please wait ${env.otp.resendCooldownSeconds} seconds before requesting another OTP.`,
      429,
      ErrorCode.TOO_MANY_REQUESTS,
    );
  }

  const otp = generateOtp(env.otp.length);
  const requestId = generateRequestId();
  const expiresAt = new Date(Date.now() + env.otp.expiryMinutes * 60 * 1000);

  await Otp.updateMany({ phone, role, isVerified: false }, { isVerified: true });

  await Otp.create({
    requestId,
    phone,
    role,
    otpHash: hashOtp(otp),
    expiresAt,
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });

  const provider = getOtpProvider();
  const delivery = await provider.sendOtp(phone, otp);
  if (!delivery.success) {
    throw new AppError('Failed to send OTP. Please try again later.', 500, ErrorCode.INTERNAL_ERROR);
  }

  const response: { requestId: string; otp?: string } = { requestId };
  if (env.otp.exposeInResponse) {
    response.otp = otp;
  }

  return response;
}

export async function verifyOtp(input: VerifyOtpInput) {
  const phone = normalizePhone(input.phone);
  const role = input.role as UserRole.CUSTOMER | UserRole.PROVIDER;

  const otpRecord = await Otp.findOne({
    phone,
    role,
    isVerified: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError('OTP expired or not found. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    otpRecord.isVerified = true;
    await otpRecord.save();
    throw new AppError('OTP has expired. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.attempts >= env.otp.maxAttempts) {
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429, ErrorCode.TOO_MANY_REQUESTS);
  }

  if (!verifyOtpHash(input.otp, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new AppError('Incorrect OTP. Please try again.', 400, ErrorCode.VALIDATION_ERROR);
  }

  otpRecord.isVerified = true;
  await otpRecord.save();

  let user = await User.findOne({ phone, role });
  const isNewUser = !user;

  if (!user) {
    if (role === UserRole.CUSTOMER) {
      if (!env.isTest) {
        throw new AppError(
          'No account found with this number. Please create an account first.',
          404,
          ErrorCode.NOT_FOUND,
        );
      }

      user = await User.create({
        phone,
        role,
        isPhoneVerified: true,
        isProfileComplete: false,
        status: 'ACTIVE',
      });

      await CustomerProfile.create({
        userId: user._id,
        fullName: 'Test Customer',
      });
    } else {
      user = await User.create({
        phone,
        role,
        isPhoneVerified: true,
        isProfileComplete: false,
        status: 'ACTIVE',
      });

      await ProviderProfile.create({
        userId: user._id,
        providerStatus: ProviderStatus.PENDING,
        isProfileComplete: false,
        isVerified: false,
        languages: [],
      });
    }
  } else {
    user.isPhoneVerified = true;
    await user.save();
  }

  const tokens = await issueTokens(user._id.toString(), user.role);
  const profile =
    role === UserRole.CUSTOMER
      ? await CustomerProfile.findOne({ userId: user._id })
      : await ProviderProfile.findOne({ userId: user._id });

  const serializedUser =
    role === UserRole.CUSTOMER
      ? await serializeCustomerUser(user, profile as ICustomerProfile | null)
      : serializeUser(user, profile);

  return {
    user: serializedUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser,
    requiresProfileCompletion: !user.isProfileComplete,
  };
}

export async function registerRequestOtp(
  input: RegisterRequestInput,
): Promise<{ requestId: string; otp?: string }> {
  const phone = normalizePhone(input.phone);
  const role = UserRole.CUSTOMER;

  const existing = await User.findOne({ phone, role });
  if (existing) {
    throw new AppError(
      'An account already exists with this number. Please log in.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const mpinHash = await bcrypt.hash(input.mpin, 12);
  const otpResult = await requestOtp({ phone, role });

  await RegistrationIntent.deleteMany({ phone, role });
  await RegistrationIntent.create({
    requestId: otpResult.requestId,
    phone,
    role,
    fullName: input.fullName?.trim(),
    email: input.email?.trim().toLowerCase(),
    referralCode: input.referralCode?.trim().toUpperCase(),
    mpinHash,
    expiresAt: new Date(Date.now() + env.otp.expiryMinutes * 60 * 1000),
  });

  return otpResult;
}

export async function registerVerifyOtp(input: RegisterVerifyInput) {
  const phone = normalizePhone(input.phone);
  const role = UserRole.CUSTOMER;

  const existing = await User.findOne({ phone, role });
  if (existing) {
    throw new AppError(
      'An account already exists with this number. Please log in.',
      409,
      ErrorCode.CONFLICT,
    );
  }

  const otpRecord = await Otp.findOne({
    phone,
    role,
    isVerified: false,
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new AppError('OTP expired or not found. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const intent = await RegistrationIntent.findOne({
    requestId: otpRecord.requestId,
    phone,
    role,
  });

  if (!intent) {
    throw new AppError('Registration session expired. Please start again.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (intent.expiresAt.getTime() < Date.now()) {
    await RegistrationIntent.deleteOne({ _id: intent._id });
    throw new AppError('Registration session expired. Please start again.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    otpRecord.isVerified = true;
    await otpRecord.save();
    throw new AppError('OTP has expired. Please request a new OTP.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (otpRecord.attempts >= env.otp.maxAttempts) {
    throw new AppError('Too many incorrect attempts. Please request a new OTP.', 429, ErrorCode.TOO_MANY_REQUESTS);
  }

  if (!verifyOtpHash(input.otp, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new AppError('Incorrect OTP. Please try again.', 400, ErrorCode.VALIDATION_ERROR);
  }

  otpRecord.isVerified = true;
  await otpRecord.save();

  const user = await User.create({
    phone,
    role,
    email: intent.email,
    fullName: intent.fullName,
    passwordHash: intent.mpinHash,
    isPhoneVerified: true,
    isProfileComplete: false,
    status: 'ACTIVE',
  });

  const profile = await CustomerProfile.create({
    userId: user._id,
    fullName: intent.fullName,
    email: intent.email,
  });

  await RegistrationIntent.deleteOne({ _id: intent._id });

  if (intent.referralCode) {
    try {
      const growthService = await import('@/modules/discovery-growth/growth.service.js');
      await growthService.redeemReferralCode(user._id.toString(), intent.referralCode);
    } catch (error) {
      logger.warn('Referral code not applied during registration', {
        userId: user._id.toString(),
        referralCode: intent.referralCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tokens = await issueTokens(user._id.toString(), user.role);

  return {
    user: await serializeCustomerUser(user, profile),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser: true,
    requiresProfileCompletion: true,
  };
}

export async function loginWithMpin(input: MpinLoginInput) {
  const phone = normalizePhone(input.phone);
  const role = UserRole.CUSTOMER;

  const user = await User.findOne({ phone, role }).select('+passwordHash');
  if (!user) {
    throw new AppError(
      'No account found with this number. Please create an account.',
      404,
      ErrorCode.NOT_FOUND,
    );
  }

  if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    throw new AppError('Account unavailable.', 403, ErrorCode.FORBIDDEN);
  }

  if (!user.passwordHash) {
    throw new AppError(
      'MPIN not set. Please set up your MPIN to continue.',
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const valid = await bcrypt.compare(input.mpin, user.passwordHash);
  if (!valid) {
    if (await isSecurityComplianceEnabled()) {
      await recordAuthFailure(user._id.toString());
    }
    throw new AppError('Incorrect MPIN. Please try again.', 401, ErrorCode.UNAUTHORIZED);
  }

  const tokens = await issueTokens(user._id.toString(), user.role);
  const profile = await CustomerProfile.findOne({ userId: user._id });

  return {
    user: await serializeCustomerUser(user, profile),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser: false,
    requiresProfileCompletion: !user.isProfileComplete,
  };
}

export async function checkPhoneRegistered(phone: string): Promise<{ canProceed: boolean }> {
  if (!phone || phone.trim().length < 10) {
    return { canProceed: false };
  }
  return { canProceed: true };
}

export async function resetMpinRequestOtp(
  input: ResetMpinRequestInput,
): Promise<{ requestId: string; otp?: string }> {
  const phone = normalizePhone(input.phone);
  const role = UserRole.CUSTOMER;

  const user = await User.findOne({ phone, role });
  if (!user) {
    throw new AppError(
      'No account found with this number. Please create an account.',
      404,
      ErrorCode.NOT_FOUND,
    );
  }

  if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    throw new AppError('Account unavailable.', 403, ErrorCode.FORBIDDEN);
  }

  return requestOtp({ phone, role });
}

export async function resetMpinConfirm(input: ResetMpinConfirmInput) {
  const phone = normalizePhone(input.phone);
  const role = UserRole.CUSTOMER;

  await validateAndConsumeOtp(phone, role, input.otp);

  const user = await User.findOne({ phone, role });
  if (!user) {
    throw new AppError(
      'No account found with this number. Please create an account.',
      404,
      ErrorCode.NOT_FOUND,
    );
  }

  if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    throw new AppError('Account unavailable.', 403, ErrorCode.FORBIDDEN);
  }

  user.passwordHash = await bcrypt.hash(input.mpin, 12);
  user.isPhoneVerified = true;
  await user.save();

  const tokens = await issueTokens(user._id.toString(), user.role);
  const profile = await CustomerProfile.findOne({ userId: user._id });

  return {
    user: await serializeCustomerUser(user, profile),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser: false,
    requiresProfileCompletion: !user.isProfileComplete,
  };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const reused = await RefreshToken.findOne({ jti: payload.jti, isRevoked: true });
  if (reused?.familyId && (await isSecurityComplianceEnabled())) {
    await handleTokenReuse(payload.sub, reused.familyId);
    throw new AppError('Session invalidated due to security concern.', 401, ErrorCode.UNAUTHORIZED);
  }

  const stored = await RefreshToken.findOne({
    jti: payload.jti,
    tokenHash,
    isRevoked: false,
  });

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw new AppError('Invalid or expired refresh token.', 401, ErrorCode.UNAUTHORIZED);
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    throw new AppError('Account unavailable.', 403, ErrorCode.FORBIDDEN);
  }

  stored.isRevoked = true;
  await stored.save();

  if (stored.sessionId) {
    await touchSession(stored.sessionId.toString());
  }

  return issueTokens(user._id.toString(), user.role, undefined, stored.familyId, stored.sessionId?.toString());
}

export async function logout(userId: string, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await RefreshToken.updateMany(
        { userId, jti: payload.jti, isRevoked: false },
        { isRevoked: true },
      );
      return;
    } catch {
      // Fall through to revoke all tokens for the user.
    }
  }

  await RefreshToken.updateMany({ userId, isRevoked: false }, { isRevoked: true });
}

export async function getCurrentUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, ErrorCode.NOT_FOUND);
  }

  const profile =
    user.role === UserRole.CUSTOMER
      ? await CustomerProfile.findOne({ userId: user._id })
      : user.role === UserRole.PROVIDER
        ? await ProviderProfile.findOne({ userId: user._id })
        : null;

  if (user.role === UserRole.CUSTOMER) {
    return serializeCustomerUser(user, profile as ICustomerProfile | null);
  }

  return serializeUser(user, profile);
}

export async function seedAdminUser(): Promise<void> {
  const existing = await User.findOne({ role: UserRole.ADMIN, email: env.admin.email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(env.admin.password, 12);
  await User.create({
    role: UserRole.ADMIN,
    email: env.admin.email,
    passwordHash,
    fullName: 'GhaarFix Admin',
    isPhoneVerified: true,
    isProfileComplete: true,
    status: 'ACTIVE',
  });
}

export async function issueTokens(
  userId: string,
  role: UserRole,
  context?: SessionContext,
  existingFamilyId?: string,
  existingSessionId?: string,
) {
  const jti = randomUUID();
  const familyId = existingFamilyId ?? randomUUID();
  const refreshToken = signRefreshToken(userId, role, jti);
  const accessToken = signAccessToken(userId, role);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let sessionId = existingSessionId;
  if (!sessionId && (await isSecurityComplianceEnabled())) {
    sessionId = await createSession(userId, role, familyId, context);
  }

  await RefreshToken.create({
    userId,
    jti,
    familyId,
    sessionId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    isRevoked: false,
  });

  return { accessToken, refreshToken, sessionId, familyId };
}
