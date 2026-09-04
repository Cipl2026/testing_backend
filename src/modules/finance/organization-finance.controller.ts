import * as orgFinance from '@/modules/finance/organization-finance.service.js';
import { listOrganizationInvoices } from '@/modules/organizations/organization-billing.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getFinance = asyncHandler(async (req, res) => {
  const data = await orgFinance.getOrganizationFinance(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Organization finance', data);
});

export const listInvoices = asyncHandler(async (req, res) => {
  const items = await listOrganizationInvoices(req.auth!.userId, String(req.params.id));
  sendSuccess(res, 'Organization invoices', { items });
});
