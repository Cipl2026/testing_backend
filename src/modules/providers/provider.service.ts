import { ProviderStatus, UserRole, ErrorCode, ProviderServiceApprovalStatus } from '@ghaarfix/shared-types';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { User } from '@/models/User.js';
import { syncProviderServiceUrgentFlags } from '@/modules/provider-services/provider-service.service.js';
import { AppError } from '@/utils/AppError.js';
import { serializeUser, serializeProviderProfile } from '@/utils/serializers.js';
import type { ProviderProfileInput } from '@/validators/auth.js';

export async function updateProviderProfile(userId: string, input: ProviderProfileInput) {
  const user = await User.findById(userId);
  if (!user || user.role !== UserRole.PROVIDER) {
    throw new AppError('Provider profile not found.', 404, ErrorCode.NOT_FOUND);
  }

  const update: Record<string, unknown> = {};
  if (input.fullName !== undefined) update.fullName = input.fullName;
  if (input.email !== undefined) update.email = input.email || undefined;
  if (input.profileImage !== undefined) update.profileImage = input.profileImage;
  if (input.dateOfBirth !== undefined) update.dateOfBirth = new Date(input.dateOfBirth);
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.experienceYears !== undefined) update.experienceYears = input.experienceYears;
  if (input.bio !== undefined) update.bio = input.bio;
  if (input.languages !== undefined) update.languages = input.languages;
  if (input.serviceBaseLatitude !== undefined && input.serviceBaseLongitude !== undefined) {
    update.serviceBase = {
      latitude: input.serviceBaseLatitude,
      longitude: input.serviceBaseLongitude,
    };
  }
  if (input.normalBookingRadiusKm !== undefined) {
    update.normalBookingRadiusKm = input.normalBookingRadiusKm;
  }
  if (input.urgentBookingRadiusKm !== undefined) {
    update.urgentBookingRadiusKm = input.urgentBookingRadiusKm;
  }
  if (input.acceptsUrgentJobs !== undefined) update.acceptsUrgentJobs = input.acceptsUrgentJobs;

  const profile = await ProviderProfile.findOneAndUpdate(
    { userId: user._id },
    update,
    { new: true, upsert: true },
  );

  const isComplete = Boolean(
    profile.fullName &&
      profile.fullName.trim().length >= 2 &&
      profile.experienceYears !== undefined &&
      profile.languages.length > 0 &&
      profile.serviceBase?.latitude != null &&
      profile.serviceBase?.longitude != null &&
      profile.normalBookingRadiusKm != null &&
      profile.urgentBookingRadiusKm != null,
  );

  profile.isProfileComplete = isComplete;
  if (profile.providerStatus !== ProviderStatus.ACTIVE) {
    profile.providerStatus = isComplete ? ProviderStatus.PENDING : profile.providerStatus;
  }
  await profile.save();

  if (isComplete) {
    await ProviderService.updateMany(
      { providerId: user._id, approvalStatus: ProviderServiceApprovalStatus.PENDING },
      { approvalStatus: ProviderServiceApprovalStatus.APPROVED, rejectionReason: undefined },
    );
    await syncProviderServiceUrgentFlags(user._id.toString());
  }

  user.fullName = profile.fullName;
  user.email = profile.email;
  user.profileImage = profile.profileImage;
  user.isProfileComplete = isComplete;
  await user.save();

  return serializeUser(user, profile);
}

export async function getProviderProfile(userId: string) {
  const user = await User.findById(userId);
  if (!user || user.role !== UserRole.PROVIDER) {
    throw new AppError('Provider profile not found.', 404, ErrorCode.NOT_FOUND);
  }
  const profile = await ProviderProfile.findOne({ userId });
  if (!profile) {
    throw new AppError('Provider profile not found.', 404, ErrorCode.NOT_FOUND);
  }
  return serializeProviderProfile(profile, user);
}
