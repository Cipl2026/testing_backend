import { AttributionModel, MarketingChannel } from '@ghaarfix/shared-types';
import { AcquisitionCostEvent } from '@/models/Finance.js';
import { CustomerValueSnapshot } from '@/models/Finance.js';
import { MarketingTouchpoint } from '@/models/CustomerLifecycle.js';

export async function recordTouchpoint(input: {
  customerId?: string;
  anonymousId?: string;
  campaignId?: string;
  channel: MarketingChannel;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  return MarketingTouchpoint.create({
    ...input,
    occurredAt: new Date(),
  });
}

export async function getAttributionSummary(model: AttributionModel = AttributionModel.LAST_TOUCH) {
  const touchpoints = await MarketingTouchpoint.find().sort({ occurredAt: -1 }).limit(500);

  const byCampaign = new Map<string, number>();
  for (const tp of touchpoints) {
    const key = tp.campaignId?.toString() ?? 'organic';
    byCampaign.set(key, (byCampaign.get(key) ?? 0) + 1);
  }

  const cacRows = await AcquisitionCostEvent.aggregate([
    { $group: { _id: '$channel', totalCostMinor: { $sum: '$costMinor' }, events: { $sum: 1 } } },
  ]);

  const ltvRows = await CustomerValueSnapshot.aggregate([
    {
      $group: {
        _id: null,
        realizedLtvMinor: { $sum: '$realizedLtvMinor' },
        predictedLtvMinor: { $sum: '$predictedLtvMinor' },
        customers: { $sum: 1 },
      },
    },
  ]);

  const totalCacMinor = cacRows.reduce((s, r) => s + r.totalCostMinor, 0);
  const realizedLtvMinor = ltvRows[0]?.realizedLtvMinor ?? 0;
  const customers = ltvRows[0]?.customers ?? 0;

  return {
    model,
    confidence: 'medium',
    touchpointsByCampaign: Object.fromEntries(byCampaign),
    cacByChannel: cacRows,
    totalCacMinor,
    realizedLtvMinor,
    predictedLtvMinor: ltvRows[0]?.predictedLtvMinor ?? 0,
    ltvCacRatio: totalCacMinor > 0 ? realizedLtvMinor / totalCacMinor : null,
    customers,
    note: 'Attribution is approximate; realized LTV and predicted LTV are reported separately.',
  };
}
