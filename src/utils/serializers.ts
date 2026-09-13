import type { IUser } from '@/models/User.js';
import type { ICustomerProfile } from '@/models/CustomerProfile.js';
import type { IProviderProfile } from '@/models/ProviderProfile.js';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { computeCustomerProfileCompletion } from '@/utils/profileCompletion.js';

function toDefaultAddressSummary(address: {
  _id: { toString(): string };
  label: string;
  addressLine1: string;
  city: string;
  postalCode: string;
}) {
  return {
    id: address._id.toString(),
    label: address.label,
    addressLine1: address.addressLine1,
    city: address.city,
    postalCode: address.postalCode,
  };
}

export interface SafeUserDefaultAddress {
  id: string;
  label: string;
  addressLine1: string;
  city: string;
  postalCode: string;
}

export interface SafeUser {
  id: string;
  role: string;
  phone: string;
  fullName?: string;
  email?: string;
  profileImage?: string;
  dateOfBirth?: string;
  defaultAddress?: SafeUserDefaultAddress | null;
  profileCompletionPercent?: number;
  isPhoneVerified: boolean;
  isProfileComplete: boolean;
}

export function serializeUser(
  user: IUser,
  profile?: ICustomerProfile | IProviderProfile | null,
  extras?: {
    profileCompletionPercent?: number;
    defaultAddress?: SafeUserDefaultAddress | null;
    dateOfBirth?: string;
  },
): SafeUser {
  const dateOfBirth =
    extras?.dateOfBirth ??
    (profile && 'dateOfBirth' in profile && profile.dateOfBirth
      ? profile.dateOfBirth.toISOString().split('T')[0]
      : undefined);

  return {
    id: user._id.toString(),
    role: user.role,
    phone: user.phone ?? '',
    fullName: profile?.fullName ?? user.fullName,
    email: profile?.email ?? user.email,
    profileImage: profile?.profileImage ?? user.profileImage,
    dateOfBirth,
    defaultAddress: extras?.defaultAddress ?? null,
    profileCompletionPercent: extras?.profileCompletionPercent,
    isPhoneVerified: user.isPhoneVerified,
    isProfileComplete: user.isProfileComplete,
  };
}

export async function serializeCustomerUser(user: IUser, profile: ICustomerProfile | null) {
  let defaultAddress: SafeUserDefaultAddress | null = null;
  let hasDefaultAddress = false;

  if (profile?.defaultAddressId) {
    const address = await CustomerAddress.findById(profile.defaultAddressId);
    if (address) {
      hasDefaultAddress = true;
      defaultAddress = toDefaultAddressSummary(address);
    }
  }

  if (!hasDefaultAddress) {
    const address =
      (await CustomerAddress.findOne({ customerId: user._id, isDefault: true })) ??
      (await CustomerAddress.findOne({ customerId: user._id }).sort({ createdAt: -1 }));
    if (address) {
      hasDefaultAddress = true;
      defaultAddress = toDefaultAddressSummary(address);
    }
  }

  const profileCompletionPercent = computeCustomerProfileCompletion(profile, hasDefaultAddress);

  return serializeUser(user, profile, {
    profileCompletionPercent,
    defaultAddress,
    dateOfBirth: profile?.dateOfBirth?.toISOString().split('T')[0],
  });
}

export interface ProviderProfileDto {
  fullName?: string;
  email?: string;
  profileImage?: string;
  dateOfBirth?: string;
  gender?: string;
  experienceYears?: number;
  bio?: string;
  languages: string[];
  serviceBaseLatitude?: number;
  serviceBaseLongitude?: number;
  normalBookingRadiusKm?: number;
  urgentBookingRadiusKm?: number;
  acceptsUrgentJobs: boolean;
  isProfileComplete: boolean;
  isVerified: boolean;
  providerStatus: string;
}

export function serializeProviderProfile(
  profile: IProviderProfile,
  user?: IUser | null,
): ProviderProfileDto {
  return {
    fullName: profile.fullName ?? user?.fullName,
    email: profile.email ?? user?.email,
    profileImage: profile.profileImage ?? user?.profileImage,
    dateOfBirth: profile.dateOfBirth?.toISOString().split('T')[0],
    gender: profile.gender,
    experienceYears: profile.experienceYears,
    bio: profile.bio,
    languages: profile.languages ?? [],
    serviceBaseLatitude: profile.serviceBase?.latitude,
    serviceBaseLongitude: profile.serviceBase?.longitude,
    normalBookingRadiusKm: profile.normalBookingRadiusKm,
    urgentBookingRadiusKm: profile.urgentBookingRadiusKm,
    acceptsUrgentJobs: profile.acceptsUrgentJobs !== false,
    isProfileComplete: profile.isProfileComplete,
    isVerified: profile.isVerified,
    providerStatus: profile.providerStatus,
  };
}
