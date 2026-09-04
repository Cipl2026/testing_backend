import { ErrorCode } from '@ghaarfix/shared-types';
import * as availabilityService from '@/modules/provider-availability/availability.service.js';
import * as reservationService from '@/modules/provider-availability/reservation.service.js';
import * as serviceAreaService from '@/modules/provider-availability/service-area.service.js';
import * as scheduleService from '@/modules/provider-availability/schedule.service.js';
import * as timeOffService from '@/modules/provider-availability/time-off.service.js';
import { AppError } from '@/utils/AppError.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const discoverProviders = asyncHandler(async (req, res) => {
  const result = await availabilityService.discoverProvidersForService(
    req.auth!.userId,
    String(req.params.serviceId),
    req.query.addressId as string,
    req.query as never,
  );
  sendSuccess(res, 'Providers fetched successfully', { items: result.items }, 200, result.meta);
});

export const getProviderAvailability = asyncHandler(async (req, res) => {
  const result = await availabilityService.getAvailableSlots({
    providerId: String(req.params.providerId),
    serviceId: req.query.serviceId as string,
    addressId: req.query.addressId as string,
    customerId: req.auth!.userId,
    date: req.query.date as string,
  });
  sendSuccess(res, 'Availability fetched successfully', result);
});

export const createReservation = asyncHandler(async (req, res) => {
  const reservation = await reservationService.createSlotReservation(req.auth!.userId, req.body);
  sendSuccess(res, 'Slot reserved successfully', reservation, 201);
});

export const releaseReservation = asyncHandler(async (req, res) => {
  await reservationService.releaseSlotReservation(
    req.auth!.userId,
    String(req.params.reservationId),
  );
  sendSuccess(res, 'Reservation released successfully', null);
});

export const getReservation = asyncHandler(async (req, res) => {
  const reservation = await reservationService.getSlotReservation(
    req.auth!.userId,
    String(req.params.reservationId),
  );
  sendSuccess(res, 'Reservation fetched successfully', reservation);
});

export const listServiceAreas = asyncHandler(async (req, res) => {
  const items = await serviceAreaService.listServiceAreas(req.auth!.userId);
  sendSuccess(res, 'Service areas fetched successfully', { items });
});

export const createServiceArea = asyncHandler(async (req, res) => {
  const area = await serviceAreaService.createServiceArea(req.auth!.userId, req.body);
  sendSuccess(res, 'Service area created successfully', area, 201);
});

export const updateServiceArea = asyncHandler(async (req, res) => {
  const area = await serviceAreaService.updateServiceArea(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Service area updated successfully', area);
});

export const deleteServiceArea = asyncHandler(async (req, res) => {
  await serviceAreaService.deleteServiceArea(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Service area deleted successfully', null);
});

export const getSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.getSchedule(req.auth!.userId);
  sendSuccess(res, 'Schedule fetched successfully', schedule);
});

export const upsertSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.upsertSchedule(req.auth!.userId, req.body);
  sendSuccess(res, 'Schedule updated successfully', schedule);
});

export const listTimeOff = asyncHandler(async (req, res) => {
  const items = await timeOffService.listTimeOff(req.auth!.userId);
  sendSuccess(res, 'Time off fetched successfully', { items });
});

export const createTimeOff = asyncHandler(async (req, res) => {
  const timeOff = await timeOffService.createTimeOff(req.auth!.userId, req.body);
  sendSuccess(res, 'Time off created successfully', timeOff, 201);
});

export const updateTimeOff = asyncHandler(async (req, res) => {
  const timeOff = await timeOffService.updateTimeOff(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Time off updated successfully', timeOff);
});

export const deleteTimeOff = asyncHandler(async (req, res) => {
  await timeOffService.deleteTimeOff(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Time off deleted successfully', null);
});

export const getProviderPublicProfile = asyncHandler(async (req, res) => {
  const { ProviderProfile } = await import('@/models/ProviderProfile.js');
  const { User } = await import('@/models/User.js');
  const { ProviderService } = await import('@/models/ProviderService.js');
  const { Service } = await import('@/models/Service.js');
  const { ProviderServiceArea } = await import('@/models/ProviderServiceArea.js');
  const { ProviderServiceApprovalStatus } = await import('@ghaarfix/shared-types');
  const { getCustomerAddressForMatching } = await import('@/modules/addresses/address.service.js');
  const { distanceKm: calcDistanceKm } = await import('@/utils/intervals.js');

  const providerId = String(req.params.providerId);
  const serviceId = req.query.serviceId as string;
  const addressId = req.query.addressId as string;

  const [profile, user, ps, service, address, serviceArea] = await Promise.all([
    ProviderProfile.findOne({ userId: providerId }),
    User.findById(providerId),
    ProviderService.findOne({
      providerId,
      serviceId,
      approvalStatus: ProviderServiceApprovalStatus.APPROVED,
      isActive: true,
    }),
    Service.findById(serviceId),
    getCustomerAddressForMatching(req.auth!.userId, addressId).catch(() => null),
    ProviderServiceArea.findOne({ providerId, isActive: true }),
  ]);

  if (!profile || !user || !ps || !service) {
    throw new AppError('Provider not found.', 404, ErrorCode.NOT_FOUND);
  }

  let distanceKm: number | undefined;
  if (address && serviceArea) {
    const [lon, lat] = address.location.coordinates;
    const raw = calcDistanceKm(lat, lon, serviceArea.center.latitude, serviceArea.center.longitude);
    distanceKm = Math.round(raw * 10) / 10;
  }

  sendSuccess(res, 'Provider profile fetched successfully', {
    id: providerId,
    fullName: profile.fullName ?? user.fullName,
    profileImage: profile.profileImage ?? user.profileImage,
    experienceYears: ps.experienceYears ?? profile.experienceYears,
    languages: profile.languages,
    bio: profile.bio,
    distanceKm,
    serviceAreaNote: distanceKm != null
      ? `Serves your area · ${distanceKm} km away`
      : 'Service available in your area',
    service: {
      id: service._id.toString(),
      name: service.name,
      startingPrice: ps.customPricing?.enabled
        ? ps.customPricing.startingPrice
        : service.pricing.startingPrice,
      currency: service.pricing.currency,
      description: ps.description,
    },
  });
});
