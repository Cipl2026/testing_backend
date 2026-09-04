import { logger } from '@/utils/logger.js';
import { processFinanceOutbox } from '@/modules/finance/finance-integration.service.js';
import { rebuildBookingFinancialSnapshot } from '@/modules/finance/booking-economics.service.js';
import { buildServiceProfitabilitySnapshots, buildCityFinancialSnapshots } from '@/modules/finance/profitability.service.js';
import { detectFinancialAnomalies, buildCashFlowForecast } from '@/modules/finance/financial-anomaly.service.js';
import { calculateAllCustomerValues } from '@/modules/finance/customer-value.service.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';
import { postBookingServiceRevenue } from '@/modules/finance/finance-integration.service.js';
import { isFinanceBiEnabled } from '@/modules/finance/finance-feature.service.js';

export async function rebuildRecentBookingSnapshots(limit = 50): Promise<number> {
  const bookings = await Booking.find({ status: BookingStatus.COMPLETED })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('_id');

  let count = 0;
  for (const b of bookings) {
    await postBookingServiceRevenue(b._id.toString());
    await rebuildBookingFinancialSnapshot(b._id.toString());
    count += 1;
  }
  return count;
}

export async function runPhase19Jobs() {
  if (!(await isFinanceBiEnabled())) {
    return {
      enabled: false,
      outbox: 0,
      snapshots: 0,
      profitability: 0,
      anomalies: 0,
      forecasts: 0,
      customerValues: 0,
    };
  }

  const results = await Promise.allSettled([
    processFinanceOutbox(),
    rebuildRecentBookingSnapshots(20),
    buildServiceProfitabilitySnapshots(),
    buildCityFinancialSnapshots(),
    detectFinancialAnomalies(),
    buildCashFlowForecast(),
    calculateAllCustomerValues(50),
  ]);

  const summary = {
    enabled: true,
    outbox: results[0].status === 'fulfilled' ? results[0].value : 0,
    snapshots: results[1].status === 'fulfilled' ? results[1].value : 0,
    profitability: results[2].status === 'fulfilled' ? results[2].value : 0,
    citySnapshots: results[3].status === 'fulfilled' ? results[3].value : 0,
    anomalies: results[4].status === 'fulfilled' ? results[4].value : 0,
    forecasts: results[5].status === 'fulfilled' ? 1 : 0,
    customerValues: results[6].status === 'fulfilled' ? results[6].value : 0,
  };

  if (Object.values(summary).some((v) => typeof v === 'number' && v > 0)) {
    logger.info('Ran Phase 19 finance jobs', summary);
  }

  return summary;
}
