import { ProviderServiceApprovalStatus, ProviderStatus } from '@ghaarfix/shared-types';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { getProviderScheduleDocument } from '@/modules/provider-availability/schedule.service.js';

function countEnabledDays(schedule: Awaited<ReturnType<typeof getProviderScheduleDocument>>) {
  if (!schedule?.weeklySchedule) return 0;
  return Object.values(schedule.weeklySchedule).filter((day) => day?.enabled).length;
}

export async function getProviderOnboardingStatus(providerId: string) {
  const [profile, approvedServices, serviceAreas, schedule] = await Promise.all([
    ProviderProfile.findOne({ userId: providerId }),
    ProviderService.countDocuments({
      providerId,
      isActive: true,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    }),
    ProviderServiceArea.countDocuments({ providerId, isActive: true }),
    getProviderScheduleDocument(providerId),
  ]);

  const steps = {
    profile: Boolean(profile?.isProfileComplete),
    services: approvedServices > 0,
    serviceAreas: serviceAreas > 0,
    availability: countEnabledDays(schedule) > 0,
    verification: Boolean(profile?.isVerified),
    adminApproved: profile?.providerStatus === ProviderStatus.ACTIVE,
  };

  const requiredForDashboard = ['profile', 'services', 'serviceAreas', 'availability'] as const;
  const readyForDashboard = requiredForDashboard.every((key) => steps[key]);
  const completedCount = requiredForDashboard.filter((key) => steps[key]).length;

  return {
    steps,
    readyForDashboard,
    completionPercent: Math.round((completedCount / requiredForDashboard.length) * 100),
    nextStep: requiredForDashboard.find((key) => !steps[key]) ?? null,
  };
}
