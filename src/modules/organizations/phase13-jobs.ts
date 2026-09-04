import * as bulkService from '@/modules/organizations/bulk-booking.service.js';
import * as billingService from '@/modules/organizations/organization-billing.service.js';
import * as analyticsService from '@/modules/organizations/organization-analytics.service.js';
import * as slaService from '@/modules/organizations/sla.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase13Jobs(): Promise<{
  bulkProcessed: number;
  slaMonitored: number;
  overdueInvoices: number;
  healthScores: number;
}> {
  const [bulkProcessed, slaResult, overdueInvoices, healthScores] = await Promise.all([
    bulkService.processAllPendingBulkBookings(),
    slaService.monitorActiveSlas(),
    billingService.markOverdueInvoices(),
    analyticsService.calculatePropertyHealthScores(),
  ]);

  const slaMonitored = slaResult.atRisk + slaResult.breached;
  if (bulkProcessed > 0 || slaMonitored > 0 || overdueInvoices > 0 || healthScores > 0) {
    logger.info('Phase 13 organization jobs completed', {
      bulkProcessed,
      slaMonitored,
      overdueInvoices,
      healthScores,
    });
  }

  return { bulkProcessed, slaMonitored, overdueInvoices, healthScores };
}
