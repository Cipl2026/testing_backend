import * as cityService from '@/modules/operations/city.service.js';
import * as serviceZoneService from '@/modules/operations/service-zone.service.js';
import * as zoneAvailabilityService from '@/modules/operations/zone-availability.service.js';
import * as operationsAdminService from '@/modules/operations/operations-admin.service.js';
import * as waitlistService from '@/modules/operations/waitlist.service.js';
import * as providerCapacityService from '@/modules/operations/provider-capacity.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const adminListCities = asyncHandler(async (_req, res) => {
  const items = await cityService.listCities(false);
  sendSuccess(res, 'Cities fetched successfully', { items });
});

export const adminCreateCity = asyncHandler(async (req, res) => {
  const city = await cityService.createCity(req.body);
  sendSuccess(res, 'City created', city, 201);
});

export const adminUpdateCity = asyncHandler(async (req, res) => {
  const city = await cityService.updateCity(String(req.params.id), req.body);
  sendSuccess(res, 'City updated', city);
});

export const adminDeleteCity = asyncHandler(async (req, res) => {
  await cityService.deleteCity(String(req.params.id));
  sendSuccess(res, 'City deleted', null);
});

export const adminListServiceZones = asyncHandler(async (req, res) => {
  const { cityId } = req.query as { cityId?: string };
  const items = await serviceZoneService.listServiceZones({ cityId, activeOnly: false });
  sendSuccess(res, 'Service zones fetched', { items });
});

export const adminCreateServiceZone = asyncHandler(async (req, res) => {
  const zone = await serviceZoneService.createServiceZone(req.body);
  sendSuccess(res, 'Service zone created', zone, 201);
});

export const adminUpdateServiceZone = asyncHandler(async (req, res) => {
  const zone = await serviceZoneService.updateServiceZone(String(req.params.id), req.body);
  sendSuccess(res, 'Service zone updated', zone);
});

export const adminDeleteServiceZone = asyncHandler(async (req, res) => {
  await serviceZoneService.deleteServiceZone(String(req.params.id));
  sendSuccess(res, 'Service zone deleted', null);
});

export const adminUpsertZoneAvailability = asyncHandler(async (req, res) => {
  const row = await zoneAvailabilityService.upsertZoneAvailability(req.body);
  sendSuccess(res, 'Zone availability updated', row);
});

export const adminDeleteZoneAvailability = asyncHandler(async (req, res) => {
  const { serviceZoneId, serviceId } = req.body as { serviceZoneId: string; serviceId: string };
  await zoneAvailabilityService.removeZoneAvailability(serviceZoneId, serviceId);
  sendSuccess(res, 'Zone availability removed', null);
});

export const adminZoneDemand = asyncHandler(async (req, res) => {
  const { serviceZoneId, days } = req.query as { serviceZoneId?: string; days?: number };
  const items = await operationsAdminService.getZoneDemandMetrics(serviceZoneId, days);
  sendSuccess(res, 'Zone demand metrics fetched', { items });
});

export const adminProviderCapacity = asyncHandler(async (req, res) => {
  const { date } = req.query as { date?: string };
  const items = await operationsAdminService.listProviderCapacityAdmin(date);
  sendSuccess(res, 'Provider capacity fetched', { items });
});

export const adminWaitlist = asyncHandler(async (req, res) => {
  const { serviceZoneId, status } = req.query as { serviceZoneId?: string; status?: never };
  const items = await waitlistService.listWaitlistAdmin({ serviceZoneId, status });
  sendSuccess(res, 'Waitlist entries fetched', { items });
});

export const adminWaitlistSummary = asyncHandler(async (_req, res) => {
  const summary = await operationsAdminService.getWaitlistAdminSummary();
  sendSuccess(res, 'Waitlist summary fetched', summary);
});

export const adminSystemHealth = asyncHandler(async (_req, res) => {
  const health = await operationsAdminService.getSystemHealth();
  sendSuccess(res, 'System health fetched', health);
});

export const adminQueueStats = asyncHandler(async (_req, res) => {
  const stats = await operationsAdminService.getQueueAdminStats();
  sendSuccess(res, 'Queue stats fetched', stats);
});

export const adminDlq = asyncHandler(async (_req, res) => {
  const items = await operationsAdminService.listDlqEntries();
  sendSuccess(res, 'DLQ entries fetched', { items });
});

export const providerGetCapacity = asyncHandler(async (req, res) => {
  const capacity = await providerCapacityService.getProviderCapacity(req.auth!.userId);
  sendSuccess(res, 'Provider capacity fetched', capacity);
});

export const providerPatchCapacity = asyncHandler(async (req, res) => {
  const capacity = await providerCapacityService.updateProviderCapacity(
    req.auth!.userId,
    req.body,
  );
  sendSuccess(res, 'Provider capacity updated', capacity);
});
