import * as adminService from '@/modules/finance/finance-admin.service.js';
import * as ledgerService from '@/modules/finance/financial-ledger.service.js';
import * as bookingEconomics from '@/modules/finance/booking-economics.service.js';
import * as anomalyService from '@/modules/finance/financial-anomaly.service.js';
import * as approvalService from '@/modules/finance/financial-approval.service.js';
import { listReconciliation } from '@/modules/finance/reconciliation.service.js';
import { getCustomerEconomicsSummary } from '@/modules/finance/customer-value.service.js';
import { CashFlowForecast } from '@/models/Finance.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await adminService.getFinanceOverview();
  sendSuccess(res, 'Finance overview', data);
});

export const getLedger = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string>;
  const data = await ledgerService.queryFinancialTimeline({
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    eventType: q.eventType as never,
    sourceType: q.sourceType as never,
    bookingId: q.bookingId,
    providerId: q.providerId,
    customerId: q.customerId,
    cityId: q.cityId,
    zoneId: q.zoneId,
    serviceId: q.serviceId,
    status: q.status as never,
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
  });

  if (req.auth?.userId) {
    await AdminAuditLog.create({
      adminId: req.auth.userId,
      action: 'FINANCE_LEDGER_EXPORT',
      entityType: 'FinancialEvent',
      entityId: req.auth.userId as never,
      reason: 'Ledger query',
      after: { filters: q, resultCount: data.items.length },
    });
  }

  sendSuccess(res, 'Financial ledger', data);
});

export const getBookingEconomics = asyncHandler(async (req, res) => {
  const data = await bookingEconomics.getBookingEconomics(String(req.params.bookingId));
  sendSuccess(res, 'Booking economics', data);
});

export const getServiceProfitability = asyncHandler(async (req, res) => {
  const { listServiceProfitability } = await import('@/modules/finance/profitability.service.js');
  const data = await listServiceProfitability(req.query as never);
  sendSuccess(res, 'Service profitability', data);
});

export const getCityProfitability = asyncHandler(async (req, res) => {
  const { listCityProfitability } = await import('@/modules/finance/profitability.service.js');
  const data = await listCityProfitability(req.query as never);
  sendSuccess(res, 'City profitability', data);
});

export const getZoneProfitability = asyncHandler(async (_req, res) => {
  const data = await adminService.getZoneProfitability();
  sendSuccess(res, 'Zone profitability', { items: data });
});

export const getPayouts = asyncHandler(async (req, res) => {
  const data = await adminService.getPayoutFinance(req.query as never);
  sendSuccess(res, 'Payout reconciliation', data);
});

export const getReconciliation = asyncHandler(async (req, res) => {
  const data = await listReconciliation(req.query as never);
  sendSuccess(res, 'Reconciliation', data);
});

export const getSubscriptions = asyncHandler(async (_req, res) => {
  const data = await adminService.getSubscriptionFinance();
  sendSuccess(res, 'Subscription economics', data);
});

export const getMarketplace = asyncHandler(async (_req, res) => {
  const data = await adminService.getMarketplaceEconomics();
  sendSuccess(res, 'Marketplace economics', data);
});

export const getCustomerEconomics = asyncHandler(async (_req, res) => {
  const data = await getCustomerEconomicsSummary();
  sendSuccess(res, 'Customer economics', data);
});

export const getCashFlow = asyncHandler(async (_req, res) => {
  const forecast = await CashFlowForecast.find().sort({ createdAt: -1 }).limit(12);
  sendSuccess(res, 'Cash flow forecast', { items: forecast });
});

export const getAlerts = asyncHandler(async (req, res) => {
  const data = await anomalyService.listAlerts(req.query as never);
  sendSuccess(res, 'Financial alerts', data);
});

export const acknowledgeAlert = asyncHandler(async (req, res) => {
  const alert = await anomalyService.acknowledgeAlert(String(req.params.id));
  sendSuccess(res, 'Alert acknowledged', alert);
});

export const createAdjustment = asyncHandler(async (req, res) => {
  const approval = await approvalService.requestFinancialAdjustment({
    ...req.body,
    requestedBy: req.auth!.userId,
  });
  sendSuccess(res, 'Adjustment requested', approval, 201);
});

export const approveAdjustment = asyncHandler(async (req, res) => {
  const approval = await approvalService.approveFinancialAdjustment(
    String(req.params.id),
    req.auth!.userId,
  );
  sendSuccess(res, 'Adjustment approved', approval);
});

export const rejectAdjustment = asyncHandler(async (req, res) => {
  const approval = await approvalService.rejectFinancialAdjustment(
    String(req.params.id),
    req.auth!.userId,
  );
  sendSuccess(res, 'Adjustment rejected', approval);
});
