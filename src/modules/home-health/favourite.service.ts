import { ErrorCode, ProviderServiceApprovalStatus, ProviderStatus } from '@ghaarfix/shared-types';
import { CustomerFavouriteProvider } from '@/models/CustomerFavouriteProvider.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { AppError } from '@/utils/AppError.js';

export async function listFavouriteProviders(customerId: string) {
  const favourites = await CustomerFavouriteProvider.find({ customerId }).sort({ createdAt: -1 });
  const items = [];
  for (const fav of favourites) {
    const [profile, trust] = await Promise.all([
      ProviderProfile.findOne({ userId: fav.providerId }),
      ProviderTrustMetrics.findOne({ providerId: fav.providerId }),
    ]);
    if (!profile || profile.providerStatus !== ProviderStatus.ACTIVE) continue;
    items.push({
      providerId: fav.providerId.toString(),
      fullName: profile.fullName,
      profileImage: profile.profileImage,
      experienceYears: profile.experienceYears,
      averageRating: trust?.averageRating ?? 0,
      completedJobs: trust?.completedJobs ?? 0,
      isVerified: profile.isVerified,
      favouritedAt: fav.createdAt.toISOString(),
    });
  }
  return items;
}

export async function addFavouriteProvider(customerId: string, providerId: string) {
  const profile = await ProviderProfile.findOne({ userId: providerId, providerStatus: ProviderStatus.ACTIVE });
  if (!profile) throw new AppError('Provider not found.', 404, ErrorCode.NOT_FOUND);

  const existing = await CustomerFavouriteProvider.findOne({ customerId, providerId });
  if (existing) return { providerId, favourited: true };

  await CustomerFavouriteProvider.create({ customerId, providerId });
  return { providerId, favourited: true };
}

export async function removeFavouriteProvider(customerId: string, providerId: string) {
  await CustomerFavouriteProvider.deleteOne({ customerId, providerId });
  return { providerId, favourited: false };
}

export async function isFavouriteProvider(customerId: string, providerId: string) {
  const exists = await CustomerFavouriteProvider.exists({ customerId, providerId });
  return Boolean(exists);
}

export async function validateFavouriteProviderForService(providerId: string, serviceId: string) {
  const { ProviderService } = await import('@/models/ProviderService.js');
  const profile = await ProviderProfile.findOne({ userId: providerId, providerStatus: ProviderStatus.ACTIVE });
  const ps = await ProviderService.findOne({
    providerId,
    serviceId,
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
  });
  return Boolean(profile && ps);
}
