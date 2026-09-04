import { resolveRegionFromLocation } from '@/modules/globalization/region-resolve.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const resolveRegion = asyncHandler(async (req, res) => {
  const data = await resolveRegionFromLocation({
    latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
    longitude: req.query.longitude ? Number(req.query.longitude) : undefined,
    city: req.query.city as string | undefined,
    state: req.query.state as string | undefined,
    countryCode: req.query.countryCode as string | undefined,
    postalCode: req.query.postalCode as string | undefined,
  });
  sendSuccess(res, 'Region resolved', data);
});
