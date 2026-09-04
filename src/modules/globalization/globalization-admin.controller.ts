import * as adminService from '@/modules/globalization/globalization-admin.service.js';
import * as regionService from '@/modules/globalization/region.service.js';
import * as serviceAreaService from '@/modules/globalization/service-area.service.js';
import * as partnerService from '@/modules/globalization/partner.service.js';
import { resolveRegionalPolicies, upsertRegionalConfiguration } from '@/modules/globalization/regional-config.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getExpansionOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getExpansionOverview();
  sendSuccess(res, 'Expansion overview fetched', data);
});

export const listRegions = asyncHandler(async (req, res) => {
  const items = await regionService.listRegions(
    req.query.type as never,
    req.query.parentId as string | undefined,
  );
  sendSuccess(res, 'Regions fetched', { items });
});

export const createRegion = asyncHandler(async (req, res) => {
  const data = await regionService.createRegion(req.body);
  sendSuccess(res, 'Region created', data, 201);
});

export const getRegion = asyncHandler(async (req, res) => {
  const data = await regionService.getRegion(String(req.params.id));
  sendSuccess(res, 'Region fetched', data);
});

export const updateRegion = asyncHandler(async (req, res) => {
  const data = await regionService.updateRegion(String(req.params.id), req.body);
  sendSuccess(res, 'Region updated', data);
});

export const activateRegion = asyncHandler(async (req, res) => {
  const data = await regionService.activateRegion(String(req.params.id));
  sendSuccess(res, 'Region activated', data);
});

export const deactivateRegion = asyncHandler(async (req, res) => {
  const data = await regionService.deactivateRegion(String(req.params.id));
  sendSuccess(res, 'Region deactivated', data);
});

export const getRegionConfiguration = asyncHandler(async (req, res) => {
  const data = await resolveRegionalPolicies(String(req.params.id));
  sendSuccess(res, 'Region configuration fetched', data);
});

export const updateRegionConfiguration = asyncHandler(async (req, res) => {
  const config = await upsertRegionalConfiguration(
    String(req.params.id),
    req.body,
    req.auth?.userId,
  );
  const resolved = await resolveRegionalPolicies(String(req.params.id));
  sendSuccess(res, 'Region configuration updated', { version: config.version, resolved });
});

export const getLaunchChecklist = asyncHandler(async (req, res) => {
  const data = await regionService.getLaunchChecklist(String(req.params.id));
  sendSuccess(res, 'Launch checklist fetched', data);
});

export const listServiceAreas = asyncHandler(async (req, res) => {
  const items = await serviceAreaService.listServiceAreas(req.query.regionId as string | undefined);
  sendSuccess(res, 'Service areas fetched', { items });
});

export const createServiceArea = asyncHandler(async (req, res) => {
  const data = await serviceAreaService.createServiceArea(req.body);
  sendSuccess(res, 'Service area created', data, 201);
});

export const updateServiceArea = asyncHandler(async (req, res) => {
  const data = await serviceAreaService.updateServiceArea(String(req.params.id), req.body);
  sendSuccess(res, 'Service area updated', data);
});

export const getRegionalCatalog = asyncHandler(async (req, res) => {
  const items = await adminService.getRegionalCatalog(req.query.regionId as string | undefined);
  sendSuccess(res, 'Regional catalog fetched', { items });
});

export const getRegionalPricing = asyncHandler(async (req, res) => {
  const items = await adminService.getRegionalPricing(req.query.regionId as string | undefined);
  sendSuccess(res, 'Regional pricing fetched', { items });
});

export const getRegionalTaxes = asyncHandler(async (req, res) => {
  const items = await adminService.getRegionalTaxes(req.query.regionId as string | undefined);
  sendSuccess(res, 'Regional taxes fetched', { items });
});

export const getRegionalPayments = asyncHandler(async (req, res) => {
  const items = await adminService.getRegionalPayments(req.query.regionId as string | undefined);
  sendSuccess(res, 'Regional payments fetched', { items });
});

export const listPartners = asyncHandler(async (_req, res) => {
  const items = await partnerService.listPartners();
  sendSuccess(res, 'Partners fetched', { items });
});

export const createPartner = asyncHandler(async (req, res) => {
  const data = await partnerService.createPartner(req.body);
  sendSuccess(res, 'Partner created', data, 201);
});

export const getPartnerPerformance = asyncHandler(async (req, res) => {
  const items = await partnerService.getPartnerPerformance(String(req.params.id));
  sendSuccess(res, 'Partner performance fetched', { items });
});

export const listDataResidency = asyncHandler(async (_req, res) => {
  const items = await adminService.expansionService.listDataResidencyPolicies();
  sendSuccess(res, 'Data residency policies fetched', { items });
});

export const getExpansionAnalytics = asyncHandler(async (_req, res) => {
  const data = await adminService.getExpansionOverview();
  sendSuccess(res, 'Expansion analytics fetched', data);
});
