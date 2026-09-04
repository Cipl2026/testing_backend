import * as cityService from '@/modules/operations/city.service.js';
import * as serviceZoneService from '@/modules/operations/service-zone.service.js';
import * as zoneAvailabilityService from '@/modules/operations/zone-availability.service.js';
import * as waitlistService from '@/modules/operations/waitlist.service.js';
import * as zoneResolutionService from '@/modules/operations/zone-resolution.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listCities = asyncHandler(async (_req, res) => {
  const cities = await cityService.listCities(true);
  sendSuccess(res, 'Cities fetched successfully', { items: cities });
});

export const listServiceZones = asyncHandler(async (req, res) => {
  const { cityId, activeOnly } = req.query as { cityId?: string; activeOnly?: boolean };
  const zones = await serviceZoneService.listServiceZones({ cityId, activeOnly });
  sendSuccess(res, 'Service zones fetched successfully', { items: zones });
});

export const resolveServiceZone = asyncHandler(async (req, res) => {
  const { city, postalCode, latitude, longitude } = req.query as {
    city?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
  const result = await zoneResolutionService.resolveAddressToZone({
    city,
    postalCode,
    location:
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : undefined,
  });
  sendSuccess(res, 'Service zone resolved', result);
});

export const getServiceAvailability = asyncHandler(async (req, res) => {
  const { serviceZoneId } = req.query as { serviceZoneId: string };
  const items = await zoneAvailabilityService.listZoneAvailability(serviceZoneId);
  sendSuccess(res, 'Service availability fetched successfully', { items });
});

export const createWaitlist = asyncHandler(async (req, res) => {
  const entry = await waitlistService.createWaitlistEntry(req.auth!.userId, req.body);
  sendSuccess(res, 'Added to waitlist', entry, 201);
});

export const listWaitlist = asyncHandler(async (req, res) => {
  const items = await waitlistService.listCustomerWaitlist(req.auth!.userId);
  sendSuccess(res, 'Waitlist fetched successfully', { items });
});

export const deleteWaitlist = asyncHandler(async (req, res) => {
  await waitlistService.cancelWaitlistEntry(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Waitlist entry cancelled', null);
});
