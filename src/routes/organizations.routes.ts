import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as orgFinanceController from '@/modules/finance/organization-finance.controller.js';
import * as controller from '@/modules/organizations/organizations.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  approvalActionBodySchema,
  approvalIdParamSchema,
  bulkBookingIdParamSchema,
  createBulkBookingBodySchema,
  createOccupantBodySchema,
  createOrgBookingBodySchema,
  createOrganizationBodySchema,
  createPropertyBodySchema,
  createUnitBodySchema,
  inviteMemberBodySchema,
  memberIdParamSchema,
  organizationIdParamSchema,
  orgInvoiceIdParamSchema,
  rejectApprovalBodySchema,
  updateMemberBodySchema,
  updateOrganizationBodySchema,
  upsertBudgetBodySchema,
} from '@/validators/phase13.js';
import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';

const router = Router();

const orgPropertyParams = z.object({ orgId: objectIdSchema, id: objectIdSchema });
const orgBookingSlaParams = z.object({
  id: objectIdSchema,
  bookingId: objectIdSchema,
});

router.post(
  '/organizations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(createOrganizationBodySchema),
  controller.createOrganization,
);
router.get(
  '/organizations/me',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listMyOrganizations,
);
router.get(
  '/organizations/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.getOrganization,
);
router.patch(
  '/organizations/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(updateOrganizationBodySchema),
  controller.updateOrganization,
);

router.get(
  '/organizations/:id/members',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listMembers,
);
router.post(
  '/organizations/:id/members/invite',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(inviteMemberBodySchema),
  controller.inviteMember,
);
router.patch(
  '/organizations/:id/members/:memberId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema.merge(memberIdParamSchema)),
  validateBody(updateMemberBodySchema),
  controller.updateMember,
);
router.delete(
  '/organizations/:id/members/:memberId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema.merge(memberIdParamSchema)),
  controller.removeMember,
);

router.get(
  '/organizations/:id/properties',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listProperties,
);
router.post(
  '/organizations/:id/properties',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(createPropertyBodySchema),
  controller.createProperty,
);

router.get(
  '/properties/:orgId/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  controller.getProperty,
);
router.patch(
  '/properties/:orgId/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  controller.updateProperty,
);

router.get(
  '/properties/:orgId/:id/units',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  controller.listUnits,
);
router.post(
  '/properties/:orgId/:id/units',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  validateBody(createUnitBodySchema),
  controller.createUnit,
);

router.get(
  '/properties/:orgId/:id/occupants',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  controller.listOccupants,
);
router.post(
  '/properties/:orgId/:id/occupants',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  validateBody(createOccupantBodySchema),
  controller.createOccupant,
);

router.get(
  '/properties/:orgId/:id/assets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgPropertyParams),
  controller.listPropertyAssets,
);

router.post(
  '/organizations/:id/bookings',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(createOrgBookingBodySchema),
  controller.createOrgBooking,
);
router.get(
  '/organizations/:id/bookings',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listOrgBookings,
);

router.post(
  '/organizations/:id/bulk-bookings',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(createBulkBookingBodySchema),
  controller.createBulkBooking,
);
router.get(
  '/bulk-bookings/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bulkBookingIdParamSchema),
  controller.getBulkBooking,
);
router.post(
  '/bulk-bookings/:id/retry-failed',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(bulkBookingIdParamSchema),
  controller.retryBulkFailed,
);

router.get(
  '/organizations/:id/approvals',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listApprovals,
);
router.post(
  '/approvals/:id/approve',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(approvalIdParamSchema),
  validateBody(approvalActionBodySchema),
  controller.approveRequest,
);
router.post(
  '/approvals/:id/reject',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(approvalIdParamSchema),
  validateBody(rejectApprovalBodySchema),
  controller.rejectRequest,
);

router.get(
  '/organizations/:id/sla',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listSla,
);
router.get(
  '/organizations/:id/sla/bookings/:bookingId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgBookingSlaParams),
  controller.getBookingSla,
);

router.get(
  '/organizations/:id/budgets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listBudgets,
);
router.post(
  '/organizations/:id/budgets',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  validateBody(upsertBudgetBodySchema),
  controller.createBudget,
);

router.get(
  '/organizations/:id/finance',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  orgFinanceController.getFinance,
);
router.get(
  '/organizations/:id/finance/invoices',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  orgFinanceController.listInvoices,
);

router.get(
  '/organizations/:id/invoices',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.listInvoices,
);
router.get(
  '/organization-invoices/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgInvoiceIdParamSchema),
  controller.getInvoice,
);
router.post(
  '/organization-invoices/:id/pay',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(orgInvoiceIdParamSchema),
  validateBody(z.object({ paymentReference: z.string().optional() })),
  controller.payInvoice,
);

router.get(
  '/organizations/:id/analytics',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.getAnalytics,
);

router.get(
  '/organizations/:id/security',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.getOrganizationSecurity,
);
router.get(
  '/organizations/:id/security/events',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(organizationIdParamSchema),
  controller.getOrganizationSecurityEvents,
);

export default router;
