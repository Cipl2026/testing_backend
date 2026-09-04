import {
  FinancialDirection,
  FinancialEventStatus,
  FinancialEventType,
} from '@ghaarfix/shared-types';
import { FinancialEvent } from '@/models/Finance.js';
import { aggregateByEventType } from '@/modules/finance/financial-ledger.service.js';
import { getLossMakingServices, listCityProfitability, listServiceProfitability } from '@/modules/finance/profitability.service.js';
import { listAlerts } from '@/modules/finance/financial-anomaly.service.js';
import { CashFlowForecast } from '@/models/Finance.js';
import { getSubscriptionAnalytics } from '@/modules/care-plans/care-plan-admin.service.js';
import { getCustomerEconomicsSummary } from '@/modules/finance/customer-value.service.js';
import { listReconciliation } from '@/modules/finance/reconciliation.service.js';
import { fromMinor } from '@/utils/money.js';

function monthBounds(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}

export async function getFinanceOverview() {
  const { start, end } = monthBounds();
  const byType = await aggregateByEventType(start, end);

  const gmvMinor =
    (byType[FinancialEventType.SERVICE_REVENUE] ?? 0) +
    (byType[FinancialEventType.MARKETPLACE_REVENUE] ?? 0) +
    (byType[FinancialEventType.PART_REVENUE] ?? 0);

  const discounts =
    (byType[FinancialEventType.DISCOUNT] ?? 0) + (byType[FinancialEventType.COUPON_COST] ?? 0);
  const refunds =
    (byType[FinancialEventType.REFUND] ?? 0) + (byType[FinancialEventType.PAYMENT_REFUNDED] ?? 0);
  const netRevenueMinor = gmvMinor - discounts - refunds;
  const providerCost = byType[FinancialEventType.PROVIDER_EARNING] ?? 0;
  const gatewayFee = byType[FinancialEventType.GATEWAY_FEE] ?? 0;
  const guaranteeCost =
    (byType[FinancialEventType.GUARANTEE_COST] ?? 0) + (byType[FinancialEventType.CLAIM_COST] ?? 0);
  const contributionMarginMinor = netRevenueMinor - providerCost - gatewayFee - guaranteeCost;

  const inflowRows = await FinancialEvent.aggregate([
    {
      $match: {
        direction: FinancialDirection.INFLOW,
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  const outflowRows = await FinancialEvent.aggregate([
    {
      $match: {
        direction: FinancialDirection.OUTFLOW,
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  const [topServices, topCities, lossMaking, alerts, forecast, subscriptions, customerEco] =
    await Promise.all([
      listServiceProfitability({ limit: 5 }),
      listCityProfitability({ limit: 5 }),
      getLossMakingServices(5),
      listAlerts({ status: 'OPEN' as never, limit: 10 }),
      CashFlowForecast.findOne().sort({ createdAt: -1 }),
      getSubscriptionAnalytics().catch(() => null),
      getCustomerEconomicsSummary(),
    ]);

  return {
    period: { start: start.toISOString(), end: end.toISOString(), timezone: 'UTC' },
    gmvMinor,
    netRevenueMinor,
    contributionMarginMinor,
    cashPositionMinor: (inflowRows[0]?.total ?? 0) - (outflowRows[0]?.total ?? 0),
    providerPayoutsMinor: byType[FinancialEventType.PROVIDER_PAYOUT] ?? providerCost,
    refundsMinor: refunds,
    topServices: topServices.items,
    topCities: topCities.items,
    lossMakingServices: lossMaking,
    forecast: forecast
      ? {
          netCashMinor: forecast.netCashMinor,
          confidence: forecast.confidence,
          rangeLowMinor: forecast.rangeLowMinor,
          rangeHighMinor: forecast.rangeHighMinor,
        }
      : null,
    alerts: alerts.items,
    subscriptions,
    customerEconomics: customerEco,
    display: {
      gmv: fromMinor(gmvMinor),
      netRevenue: fromMinor(netRevenueMinor),
      contributionMargin: fromMinor(contributionMarginMinor),
    },
  };
}

export async function getMarketplaceEconomics() {
  const { start, end } = monthBounds();
  const byType = await aggregateByEventType(start, end);
  return {
    productGmvMinor: byType[FinancialEventType.MARKETPLACE_REVENUE] ?? 0,
    refundsMinor: byType[FinancialEventType.REFUND] ?? 0,
    period: { start, end },
  };
}

export async function getSubscriptionFinance() {
  const analytics = await getSubscriptionAnalytics();
  const { start, end } = monthBounds();
  const subRevenue = await FinancialEvent.aggregate([
    {
      $match: {
        eventType: FinancialEventType.SUBSCRIPTION_REVENUE,
        status: FinancialEventStatus.POSTED,
        effectiveAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  return {
    ...analytics,
    recognizedRevenueMinor: subRevenue[0]?.total ?? 0,
    note: 'Subscription analytics from care plans; ledger revenue recognition kept separate to avoid double counting.',
  };
}

export async function getZoneProfitability() {
  const rows = await FinancialEvent.aggregate([
    {
      $match: {
        zoneId: { $exists: true },
        eventType: FinancialEventType.SERVICE_REVENUE,
        status: FinancialEventStatus.POSTED,
      },
    },
    {
      $group: {
        _id: '$zoneId',
        revenueMinor: { $sum: '$amountMinor' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { revenueMinor: -1 } },
    { $limit: 50 },
  ]);

  return rows.map((r: { _id?: unknown; revenueMinor: number; bookings: number }) => ({
    zoneId: r._id?.toString(),
    revenueMinor: r.revenueMinor,
    bookings: r.bookings,
  }));
}

export async function getPayoutFinance(query: { page?: number; limit?: number }) {
  return listReconciliation({ type: 'payout', ...query });
}
