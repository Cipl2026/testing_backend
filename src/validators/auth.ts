import { z } from 'zod';
import { userRoleSchema } from '@ghaarfix/validation';

const mobileRoleSchema = z.enum(['CUSTOMER', 'PROVIDER']);

export const requestOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  role: mobileRoleSchema,
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  role: mobileRoleSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const customerProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  profileImage: z.string().url('Invalid profile image URL').optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
});

export const providerProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  profileImage: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('/api/'),
      'Invalid profile image URL',
    )
    .optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  bio: z.string().max(1000).optional(),
  languages: z.array(z.string().trim().min(1)).max(10).optional(),
  serviceBaseLatitude: z.number().min(-90).max(90).optional(),
  serviceBaseLongitude: z.number().min(-180).max(180).optional(),
  normalBookingRadiusKm: z.number().min(1).max(200).optional(),
  urgentBookingRadiusKm: z.number().min(1).max(200).optional(),
  acceptsUrgentJobs: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const mpinSchema = z.string().regex(/^\d{4}$/, 'MPIN must be 4 digits');

export const registerRequestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  role: mobileRoleSchema,
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  referralCode: z.string().trim().min(4, 'Referral code is too short').max(20).optional(),
  mpin: mpinSchema,
});

export const registerVerifySchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  role: mobileRoleSchema,
});

export const registerResendSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  role: mobileRoleSchema,
});

export const mpinLoginSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  mpin: mpinSchema,
  role: mobileRoleSchema,
});

export const resetMpinRequestSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  role: mobileRoleSchema,
});

export const resetMpinConfirmSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  mpin: mpinSchema,
  role: mobileRoleSchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type RegisterVerifyInput = z.infer<typeof registerVerifySchema>;
export type RegisterResendInput = z.infer<typeof registerResendSchema>;
export type MpinLoginInput = z.infer<typeof mpinLoginSchema>;
export type ResetMpinRequestInput = z.infer<typeof resetMpinRequestSchema>;
export type ResetMpinConfirmInput = z.infer<typeof resetMpinConfirmSchema>;

// Re-export for middleware that needs full role list
export { userRoleSchema };
