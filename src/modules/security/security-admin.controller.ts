import * as adminService from '@/modules/security/security-admin.service.js';
import * as findingService from '@/modules/security/security-finding.service.js';
import * as threatService from '@/modules/security/threat-model.service.js';
import * as permissionService from '@/modules/security/permission.service.js';
import * as exportService from '@/modules/security/data-export.service.js';
import * as deletionService from '@/modules/security/account-deletion.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getSecurityOverview();
  sendSuccess(res, 'Security overview fetched', data);
});

export const getEvents = asyncHandler(async (req, res) => {
  const { type } = req.query as { type?: string };
  const data = await adminService.getSecurityEvents(type);
  sendSuccess(res, 'Security events fetched', { items: data });
});

export const getFindings = asyncHandler(async (_req, res) => {
  const data = await adminService.getSecurityFindings();
  sendSuccess(res, 'Security findings fetched', { items: data });
});

export const updateFinding = asyncHandler(async (req, res) => {
  const data = await findingService.updateSecurityFinding(String(req.params.id), req.body);
  sendSuccess(res, 'Finding updated', data);
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  const data = await adminService.getSecurityAuditLogs();
  sendSuccess(res, 'Security audit logs fetched', { items: data });
});

export const getDataAssets = asyncHandler(async (_req, res) => {
  const data = await adminService.getDataAssets();
  sendSuccess(res, 'Data assets fetched', { items: data });
});

export const getDataExports = asyncHandler(async (_req, res) => {
  const data = await exportService.listDataExportsAdmin();
  sendSuccess(res, 'Data exports fetched', { items: data });
});

export const getDeletionRequests = asyncHandler(async (_req, res) => {
  const data = await deletionService.listDeletionRequestsAdmin();
  sendSuccess(res, 'Deletion requests fetched', { items: data });
});

export const getThreatModels = asyncHandler(async (_req, res) => {
  const data = await adminService.getThreatModels();
  sendSuccess(res, 'Threat models fetched', { items: data });
});

export const createThreatModel = asyncHandler(async (req, res) => {
  const data = await threatService.upsertThreatModel(req.body);
  sendSuccess(res, 'Threat model saved', data, 201);
});

export const listRoles = asyncHandler(async (_req, res) => {
  const data = await adminService.getRolesAndPermissions();
  sendSuccess(res, 'Roles and permissions fetched', data);
});

export const createRole = asyncHandler(async (req, res) => {
  const data = await permissionService.createRole(req.body);
  sendSuccess(res, 'Role created', data, 201);
});

export const updateRole = asyncHandler(async (req, res) => {
  const data = await permissionService.updateRole(String(req.params.key), req.body, req.auth!.userId);
  sendSuccess(res, 'Role updated', data);
});

export const getRetentionPolicies = asyncHandler(async (_req, res) => {
  const data = await adminService.getRetentionPolicies();
  sendSuccess(res, 'Retention policies fetched', { items: data });
});
