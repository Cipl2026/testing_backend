import bcrypt from 'bcryptjs';
import { UserRole, ErrorCode, UrgentRequestStatus } from '@ghaarfix/shared-types';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { User } from '@/models/User.js';
import { issueTokens } from '@/modules/auth/auth.service.js';
import { AppError } from '@/utils/AppError.js';
import { serializeUser } from '@/utils/serializers.js';
import type { AdminLoginInput } from '@/validators/auth.js';

export async function adminLogin(input: AdminLoginInput) {
  const user = await User.findOne({
    email: input.email.toLowerCase(),
    role: UserRole.ADMIN,
  }).select('+passwordHash');

  if (!user?.passwordHash) {
    throw new AppError('Invalid email or password.', 401, ErrorCode.UNAUTHORIZED);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401, ErrorCode.UNAUTHORIZED);
  }

  if (user.status === 'BLOCKED' || user.status === 'SUSPENDED') {
    throw new AppError('Account suspended.', 403, ErrorCode.FORBIDDEN);
  }

  const tokens = await issueTokens(user._id.toString(), user.role);

  return {
    user: serializeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function getDashboardTotals() {
  const [customers, providers, urgentRequests] = await Promise.all([
    User.countDocuments({ role: UserRole.CUSTOMER, status: 'ACTIVE' }),
    ProviderProfile.countDocuments({ providerStatus: { $in: ['PENDING', 'ACTIVE'] } }),
    UrgentRequest.countDocuments({
      status: { $in: [UrgentRequestStatus.SEARCHING, UrgentRequestStatus.ASSIGNED] },
    }),
  ]);

  return {
    totals: {
      customers,
      providers,
      bookings: 0,
      urgentRequests,
    },
  };
}
