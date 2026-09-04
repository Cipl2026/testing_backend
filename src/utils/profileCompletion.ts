import type { ICustomerProfile } from '@/models/CustomerProfile.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function computeCustomerProfileCompletion(
  profile: Pick<ICustomerProfile, 'fullName' | 'email' | 'profileImage' | 'dateOfBirth'> | null | undefined,
  hasDefaultAddress: boolean,
): number {
  if (!profile) return hasDefaultAddress ? 20 : 0;

  let percent = 0;
  if (profile.profileImage) percent += 20;
  if (profile.fullName && profile.fullName.trim().length >= 2) percent += 20;
  if (profile.email && EMAIL_REGEX.test(profile.email.trim())) percent += 20;
  if (profile.dateOfBirth) percent += 20;
  if (hasDefaultAddress) percent += 20;
  return percent;
}
