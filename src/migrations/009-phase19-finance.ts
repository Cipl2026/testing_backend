import {
  FinancialEvent,
  BookingFinancialSnapshot,
  ServiceProfitabilitySnapshot,
  CityFinancialSnapshot,
  ProviderEarningsSnapshot,
  PayoutReconciliation,
  PaymentReconciliation,
  AcquisitionCostEvent,
  CustomerValueSnapshot,
  RevenueRecognitionSchedule,
  CashFlowForecast,
  FinancialAlert,
  FinancialTarget,
  FinancialApproval,
  FinanceOutbox,
} from '@/models/Finance.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { logger } from '@/utils/logger.js';

export async function runPhase19Migrations() {
  await Promise.all([
    FinancialEvent.syncIndexes(),
    BookingFinancialSnapshot.syncIndexes(),
    ServiceProfitabilitySnapshot.syncIndexes(),
    CityFinancialSnapshot.syncIndexes(),
    ProviderEarningsSnapshot.syncIndexes(),
    PayoutReconciliation.syncIndexes(),
    PaymentReconciliation.syncIndexes(),
    AcquisitionCostEvent.syncIndexes(),
    CustomerValueSnapshot.syncIndexes(),
    RevenueRecognitionSchedule.syncIndexes(),
    CashFlowForecast.syncIndexes(),
    FinancialAlert.syncIndexes(),
    FinancialTarget.syncIndexes(),
    FinancialApproval.syncIndexes(),
    FinanceOutbox.syncIndexes(),
  ]);

  await FeatureFlag.findOneAndUpdate(
    { key: FeatureFlagKey.ENABLE_FINANCE_BI },
    { key: FeatureFlagKey.ENABLE_FINANCE_BI, enabled: true, rules: [{ type: 'global' }] },
    { upsert: true },
  );

  logger.info('Phase 19 finance BI indexes ensured');
}
