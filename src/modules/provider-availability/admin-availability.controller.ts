import * as scheduleService from '@/modules/provider-availability/schedule.service.js';
import * as serviceAreaService from '@/modules/provider-availability/service-area.service.js';
import * as timeOffService from '@/modules/provider-availability/time-off.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getProviderAvailabilityOverview = asyncHandler(async (req, res) => {
  const providerId = String(req.params.providerId);
  const [serviceAreas, schedule, timeOff] = await Promise.all([
    serviceAreaService.adminListProviderServiceAreas(providerId),
    scheduleService.adminGetProviderSchedule(providerId),
    timeOffService.adminListProviderTimeOff(providerId),
  ]);

  sendSuccess(res, 'Provider availability overview fetched successfully', {
    serviceAreas,
    schedule,
    timeOff,
  });
});
