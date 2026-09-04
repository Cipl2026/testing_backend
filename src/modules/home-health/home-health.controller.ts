import * as adminService from '@/modules/home-health/admin.service.js';
import * as assetService from '@/modules/home-health/asset.service.js';
import * as favouriteService from '@/modules/home-health/favourite.service.js';
import * as homeService from '@/modules/home-health/home.service.js';
import * as insightsService from '@/modules/home-health/insights.service.js';
import * as maintenanceService from '@/modules/home-health/maintenance.service.js';
import * as warrantyService from '@/modules/home-health/warranty.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

// Homes
export const listHomes = asyncHandler(async (req, res) => {
  const items = await homeService.listHomes(req.auth!.userId);
  sendSuccess(res, 'Homes fetched successfully', { items });
});

export const createHome = asyncHandler(async (req, res) => {
  const data = await homeService.createHome(req.auth!.userId, req.body);
  sendSuccess(res, 'Home created successfully', data, 201);
});

export const getHome = asyncHandler(async (req, res) => {
  const data = await homeService.getHome(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home fetched successfully', data);
});

export const updateHome = asyncHandler(async (req, res) => {
  const data = await homeService.updateHome(req.auth!.userId, String(req.params.homeId), req.body);
  sendSuccess(res, 'Home updated successfully', data);
});

export const archiveHome = asyncHandler(async (req, res) => {
  const data = await homeService.archiveHome(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home archived successfully', data);
});

// Rooms
export const listRooms = asyncHandler(async (req, res) => {
  const items = await assetService.listRooms(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Rooms fetched successfully', { items });
});

export const createRoom = asyncHandler(async (req, res) => {
  const data = await assetService.createRoom(req.auth!.userId, String(req.params.homeId), req.body);
  sendSuccess(res, 'Room created successfully', data, 201);
});

export const updateRoom = asyncHandler(async (req, res) => {
  const data = await assetService.updateRoom(req.auth!.userId, String(req.params.roomId), req.body);
  sendSuccess(res, 'Room updated successfully', data);
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const data = await assetService.deleteRoom(req.auth!.userId, String(req.params.roomId));
  sendSuccess(res, 'Room deleted successfully', data);
});

// Assets
export const listHomeAssets = asyncHandler(async (req, res) => {
  const items = await assetService.listHomeAssets(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Assets fetched successfully', { items });
});

export const createAsset = asyncHandler(async (req, res) => {
  const data = await assetService.createAsset(req.auth!.userId, String(req.params.homeId), req.body);
  sendSuccess(res, 'Asset created successfully', data, 201);
});

export const getAsset = asyncHandler(async (req, res) => {
  const data = await assetService.getAsset(req.auth!.userId, String(req.params.assetId));
  sendSuccess(res, 'Asset fetched successfully', data);
});

export const updateAsset = asyncHandler(async (req, res) => {
  const data = await assetService.updateAsset(req.auth!.userId, String(req.params.assetId), req.body);
  sendSuccess(res, 'Asset updated successfully', data);
});

export const archiveAsset = asyncHandler(async (req, res) => {
  const data = await assetService.archiveAsset(req.auth!.userId, String(req.params.assetId));
  sendSuccess(res, 'Asset archived successfully', data);
});

export const getAssetHistory = asyncHandler(async (req, res) => {
  const items = await assetService.getAssetHistory(req.auth!.userId, String(req.params.assetId));
  sendSuccess(res, 'Asset history fetched successfully', { items });
});

export const listAssetTypes = asyncHandler(async (_req, res) => {
  const items = await assetService.listAssetTypes();
  sendSuccess(res, 'Asset types fetched successfully', { items });
});

// Warranties
export const listWarranties = asyncHandler(async (req, res) => {
  const items = await warrantyService.listAssetWarranties(req.auth!.userId, String(req.params.assetId));
  sendSuccess(res, 'Warranties fetched successfully', { items });
});

export const createWarranty = asyncHandler(async (req, res) => {
  const data = await warrantyService.createWarranty(req.auth!.userId, String(req.params.assetId), req.body);
  sendSuccess(res, 'Warranty created successfully', data, 201);
});

export const updateWarranty = asyncHandler(async (req, res) => {
  const data = await warrantyService.updateWarranty(req.auth!.userId, String(req.params.warrantyId), req.body);
  sendSuccess(res, 'Warranty updated successfully', data);
});

export const deleteWarranty = asyncHandler(async (req, res) => {
  const data = await warrantyService.deleteWarranty(req.auth!.userId, String(req.params.warrantyId));
  sendSuccess(res, 'Warranty removed successfully', data);
});

// Maintenance
export const listMaintenance = asyncHandler(async (req, res) => {
  const items = await maintenanceService.listHomeMaintenance(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Maintenance schedules fetched successfully', { items });
});

export const snoozeMaintenance = asyncHandler(async (req, res) => {
  const data = await maintenanceService.snoozeMaintenance(
    req.auth!.userId,
    String(req.params.scheduleId),
    req.body.days ?? 7,
  );
  sendSuccess(res, 'Maintenance snoozed successfully', data);
});

export const skipMaintenance = asyncHandler(async (req, res) => {
  const data = await maintenanceService.skipMaintenance(
    req.auth!.userId,
    String(req.params.scheduleId),
    req.body.reason,
  );
  sendSuccess(res, 'Maintenance skipped successfully', data);
});

export const completeMaintenance = asyncHandler(async (req, res) => {
  const data = await maintenanceService.completeMaintenanceSchedule(
    req.auth!.userId,
    String(req.params.scheduleId),
  );
  sendSuccess(res, 'Maintenance marked complete successfully', data);
});

// Insights & health
export const getHomeHealth = asyncHandler(async (req, res) => {
  const data = await insightsService.getHomeHealth(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home health fetched successfully', data);
});

export const getHomeInsights = asyncHandler(async (req, res) => {
  const data = await insightsService.getHomeInsights(req.auth!.userId, String(req.params.homeId));
  sendSuccess(res, 'Home insights fetched successfully', data);
});

// Favourites
export const listFavourites = asyncHandler(async (req, res) => {
  const items = await favouriteService.listFavouriteProviders(req.auth!.userId);
  sendSuccess(res, 'Favourite providers fetched successfully', { items });
});

export const addFavourite = asyncHandler(async (req, res) => {
  const data = await favouriteService.addFavouriteProvider(req.auth!.userId, String(req.params.providerId));
  sendSuccess(res, 'Provider added to favourites', data, 201);
});

export const removeFavourite = asyncHandler(async (req, res) => {
  const data = await favouriteService.removeFavouriteProvider(req.auth!.userId, String(req.params.providerId));
  sendSuccess(res, 'Provider removed from favourites', data);
});

// Provider asset context
export const getProviderAssetContext = asyncHandler(async (req, res) => {
  const data = await assetService.getProviderAssetContext(req.auth!.userId, String(req.params.bookingId));
  sendSuccess(res, 'Asset context fetched successfully', data);
});

// Admin
export const adminListAssetTypes = asyncHandler(async (_req, res) => {
  const items = await adminService.listAssetTypesAdmin({ activeOnly: false });
  sendSuccess(res, 'Asset types fetched successfully', { items });
});

export const adminCreateAssetType = asyncHandler(async (req, res) => {
  const data = await adminService.createAssetType(req.body);
  sendSuccess(res, 'Asset type created successfully', data, 201);
});

export const adminUpdateAssetType = asyncHandler(async (req, res) => {
  const data = await adminService.updateAssetType(String(req.params.id), req.body);
  sendSuccess(res, 'Asset type updated successfully', data);
});

export const adminListMaintenanceTemplates = asyncHandler(async (_req, res) => {
  const items = await adminService.listMaintenanceTemplatesAdmin();
  sendSuccess(res, 'Maintenance templates fetched successfully', { items });
});

export const adminCreateMaintenanceTemplate = asyncHandler(async (req, res) => {
  const data = await adminService.createMaintenanceTemplate(req.body);
  sendSuccess(res, 'Maintenance template created successfully', data, 201);
});

export const adminUpdateMaintenanceTemplate = asyncHandler(async (req, res) => {
  const data = await adminService.updateMaintenanceTemplate(String(req.params.id), req.body);
  sendSuccess(res, 'Maintenance template updated successfully', data);
});
