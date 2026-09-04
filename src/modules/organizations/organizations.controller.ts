import * as orgService from '@/modules/organizations/organization.service.js';
import * as propertyService from '@/modules/organizations/managed-property.service.js';
import * as bookingService from '@/modules/organizations/organization-booking.service.js';
import * as bulkService from '@/modules/organizations/bulk-booking.service.js';
import * as approvalService from '@/modules/organizations/approval.service.js';
import * as budgetService from '@/modules/organizations/organization-budget.service.js';
import * as billingService from '@/modules/organizations/organization-billing.service.js';
import * as analyticsService from '@/modules/organizations/organization-analytics.service.js';
import * as slaService from '@/modules/organizations/sla.service.js';
import * as orgSecurityService from '@/modules/security/organization-security.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const createOrganization = asyncHandler(async (req, res) => {
  const org = await orgService.createOrganization(req.auth!.userId, req.body);
  sendSuccess(res, 'Organization created', org, 201);
});

export const listMyOrganizations = asyncHandler(async (req, res) => {
  const items = await orgService.listMyOrganizations(req.auth!.userId);
  sendSuccess(res, 'Organizations fetched', { items });
});

export const getOrganization = asyncHandler(async (req, res) => {
  const org = await orgService.getOrganization(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Organization fetched', org);
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const org = await orgService.updateOrganization(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Organization updated', org);
});

export const listMembers = asyncHandler(async (req, res) => {
  const items = await orgService.listMembers(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Members fetched', { items });
});

export const inviteMember = asyncHandler(async (req, res) => {
  const member = await orgService.inviteMember(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Member invited', member, 201);
});

export const updateMember = asyncHandler(async (req, res) => {
  const member = await orgService.updateMember(
    req.auth!.userId,
    String(req.params.id),
    String(req.params.memberId),
    req.body,
  );
  sendSuccess(res, 'Member updated', member);
});

export const removeMember = asyncHandler(async (req, res) => {
  const member = await orgService.removeMember(
    req.auth!.userId,
    String(req.params.id),
    String(req.params.memberId),
  );
  sendSuccess(res, 'Member removed', member);
});

export const listProperties = asyncHandler(async (req, res) => {
  const items = await propertyService.listProperties(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Properties fetched', { items });
});

export const createProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.createProperty(req.auth!.userId, String(req.params.id), req.body);
  sendSuccess(res, 'Property created', property, 201);
});

export const getProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.getProperty(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
  );
  sendSuccess(res, 'Property fetched', property);
});

export const updateProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.updateProperty(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Property updated', property);
});

export const listUnits = asyncHandler(async (req, res) => {
  const items = await propertyService.listUnits(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
  );
  sendSuccess(res, 'Units fetched', { items });
});

export const createUnit = asyncHandler(async (req, res) => {
  const unit = await propertyService.createUnit(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Unit created', unit, 201);
});

export const listOccupants = asyncHandler(async (req, res) => {
  const items = await propertyService.listOccupants(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
  );
  sendSuccess(res, 'Occupants fetched', { items });
});

export const createOccupant = asyncHandler(async (req, res) => {
  const occupant = await propertyService.createOccupant(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Occupant created', occupant, 201);
});

export const listPropertyAssets = asyncHandler(async (req, res) => {
  const items = await propertyService.listPropertyAssets(
    req.auth!.userId,
    String(req.params.orgId),
    String(req.params.id),
  );
  sendSuccess(res, 'Assets fetched', { items });
});

export const createOrgBooking = asyncHandler(async (req, res) => {
  const result = await bookingService.createOrganizationBooking(
    req.auth!.userId,
    String(req.params.id),
    req.body,
  );
  sendSuccess(res, 'Organization booking processed', result, result.status === 'CREATED' ? 201 : 200);
});

export const listOrgBookings = asyncHandler(async (req, res) => {
  const items = await bookingService.listOrganizationBookings(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Bookings fetched', { items });
});

export const createBulkBooking = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
  const bulk = await bulkService.createBulkBookingRequest(req.auth!.userId, String(req.params.id), {
    ...req.body,
    idempotencyKey,
  });
  sendSuccess(res, 'Bulk booking created', bulk, 201);
});

export const getBulkBooking = asyncHandler(async (req, res) => {
  const bulk = await bulkService.getBulkBooking(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Bulk booking fetched', bulk);
});

export const retryBulkFailed = asyncHandler(async (req, res) => {
  const bulk = await bulkService.retryFailedBulkItems(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Bulk retry started', bulk);
});

export const listApprovals = asyncHandler(async (req, res) => {
  const items = await approvalService.listApprovals(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Approvals fetched', { items });
});

export const approveRequest = asyncHandler(async (req, res) => {
  const result = await approvalService.approveRequest(req.auth!.userId, String(req.params.id), req.body.reason);
  sendSuccess(res, 'Approval granted', result);
});

export const rejectRequest = asyncHandler(async (req, res) => {
  const result = await approvalService.rejectRequest(req.auth!.userId, String(req.params.id), req.body.reason);
  sendSuccess(res, 'Approval rejected', result);
});

export const listSla = asyncHandler(async (req, res) => {
  const items = await slaService.listOrganizationSla(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'SLA records fetched', { items });
});

export const getBookingSla = asyncHandler(async (req, res) => {
  const sla = await bookingService.getOrganizationBookingSla(
    req.auth!.userId,
    String(req.params.id),
    String(req.params.bookingId),
  );
  sendSuccess(res, 'Booking SLA fetched', sla);
});

export const listBudgets = asyncHandler(async (req, res) => {
  const items = await budgetService.listBudgets(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Budgets fetched', { items });
});

export const createBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.upsertBudget(req.auth!.userId, String(req.params.id), {
    ...req.body,
    periodStart: new Date(req.body.periodStart),
    periodEnd: new Date(req.body.periodEnd),
  });
  sendSuccess(res, 'Budget created', budget, 201);
});

export const listInvoices = asyncHandler(async (req, res) => {
  const items = await billingService.listOrganizationInvoices(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Invoices fetched', { items });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await billingService.getOrganizationInvoice(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Invoice fetched', invoice);
});

export const payInvoice = asyncHandler(async (req, res) => {
  const invoice = await billingService.markOrganizationInvoicePaid(
    req.auth!.userId,
    String(req.params.id),
    req.body.paymentReference,
  );
  sendSuccess(res, 'Invoice marked paid', invoice);
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getOrganizationAnalytics(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Analytics fetched', analytics);
});

export const getOrganizationSecurity = asyncHandler(async (req, res) => {
  const data = await orgSecurityService.getOrganizationSecurity(
    String(req.params.id),
    req.auth!.userId,
  );
  sendSuccess(res, 'Organization security fetched', data);
});

export const getOrganizationSecurityEvents = asyncHandler(async (req, res) => {
  const items = await orgSecurityService.getOrganizationSecurityEvents(
    String(req.params.id),
    req.auth!.userId,
  );
  sendSuccess(res, 'Organization security events fetched', { items });
});
