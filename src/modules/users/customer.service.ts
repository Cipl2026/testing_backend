import { UserRole } from '@ghaarfix/shared-types';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { computeCustomerProfileCompletion } from '@/utils/profileCompletion.js';
import { serializeCustomerUser } from '@/utils/serializers.js';
import type { CustomerProfileInput } from '@/validators/auth.js';

async function customerHasDefaultAddress(customerId: string, profile: { defaultAddressId?: unknown }) {
  if (profile.defaultAddressId) {
    const byId = await CustomerAddress.findById(profile.defaultAddressId);
    if (byId) return true;
  }
  const byFlag = await CustomerAddress.exists({ customerId, isDefault: true });
  if (byFlag) return true;
  const anyAddress = await CustomerAddress.exists({ customerId });
  return Boolean(anyAddress);
}

export async function updateCustomerProfile(userId: string, input: CustomerProfileInput) {
  const user = await User.findById(userId);
  if (!user || user.role !== UserRole.CUSTOMER) {
    throw new AppError('Customer profile not found.', 404, ErrorCode.NOT_FOUND);
  }

  const update: Record<string, unknown> = {};
  if (input.fullName !== undefined) update.fullName = input.fullName;
  if (input.email !== undefined) update.email = input.email || undefined;
  if (input.profileImage !== undefined) update.profileImage = input.profileImage;
  if (input.dateOfBirth !== undefined) {
    update.dateOfBirth = input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined;
  }

  const profile = await CustomerProfile.findOneAndUpdate(
    { userId: user._id },
    update,
    { new: true, upsert: true },
  );

  const hasDefaultAddress = await customerHasDefaultAddress(user._id.toString(), profile);
  const completion = computeCustomerProfileCompletion(profile, hasDefaultAddress);
  const isComplete = completion >= 100;

  user.fullName = profile.fullName;
  user.email = profile.email;
  user.profileImage = profile.profileImage;
  user.isProfileComplete = isComplete;
  await user.save();

  return serializeCustomerUser(user, profile);
}
