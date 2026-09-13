import { expirePendingProviderRequests } from '@/modules/bookings/booking.service.js';
import { processPendingInvoicePdfs } from '@/modules/invoices/invoice.service.js';
import {
  processMaintenanceReminders,
  processWarrantyAlerts,
  refreshMaintenanceScheduleStatuses,
} from '@/modules/home-health/maintenance.service.js';
import {
  backfillReviewReminderSentFlags,
  processReviewReminders,
} from '@/modules/reviews/review.service.js';
import { expireUrgentRequests } from '@/modules/urgent/urgent.service.js';
import { processProviderConfirmationReminders } from '@/modules/bookings/provider-confirmation.service.js';
import { expireStalePresence } from '@/modules/presence/presence.service.js';
import { cleanupOldLocationHistory } from '@/modules/tracking/location-tracking.service.js';
import { purgeExpiredChatMessages } from '@/modules/support/chat-retention.service.js';
import {
  backfillHomeOwners,
  expirePendingInvitations,
} from '@/modules/home-members/home-member.service.js';
import { detectOperationalSignals } from '@/modules/provider-quality/operational-signal.service.js';
import { aggregateAllProviderPerformance } from '@/modules/provider-quality/performance.service.js';
import { expireVerifications } from '@/modules/provider-quality/verification.service.js';
import { runPhase10Jobs } from '@/modules/discovery-growth/phase10-jobs.js';
import { runPhase11Jobs } from '@/modules/operations/phase11-jobs.js';
import { runPhase12Jobs } from '@/modules/care-plans/phase12-jobs.js';
import { runPhase13Jobs } from '@/modules/organizations/phase13-jobs.js';
import { runPhase14Jobs } from '@/modules/intelligence/phase14-jobs.js';
import { runPhase15Jobs } from '@/modules/marketplace/phase15-jobs.js';
import { runPhase16Jobs } from '@/modules/iot/phase16-jobs.js';
import { runPhase17Jobs } from '@/modules/network/phase17-jobs.js';
import { runPhase18Jobs } from '@/modules/trust-protection/phase18-jobs.js';
import { runPhase19Jobs } from '@/modules/finance/phase19-jobs.js';
import { runPhase20Jobs } from '@/modules/customer-lifecycle/phase20-jobs.js';
import { runPhase21Jobs } from '@/modules/reliability/phase21-jobs.js';
import { runPhase22Jobs } from '@/modules/security/phase22-jobs.js';
import { runPhase23Jobs } from '@/modules/performance/phase23-jobs.js';
import { runPhase24Jobs } from '@/modules/globalization/phase24-jobs.js';
import { logger } from '@/utils/logger.js';
import { rebuildProviderGeoIndex } from '@/infra/provider-geo.service.js';
import { runHomeHelpRecurringJobs } from '@/modules/home-help/home-help-recurring.jobs.js';

let interval: ReturnType<typeof setInterval> | null = null;
let phase10Initialized = false;

export async function runStartupJobs(): Promise<void> {
  try {
    const count = await backfillHomeOwners();
    if (count > 0) logger.info('Backfilled home owner memberships', { count });
  } catch (error) {
    logger.error('Failed to backfill home owners', { error });
  }

  try {
    const reviewReminderBackfill = await backfillReviewReminderSentFlags();
    if (reviewReminderBackfill > 0) {
      logger.info('Backfilled review reminder flags on completed bookings', {
        count: reviewReminderBackfill,
      });
    }
  } catch (error) {
    logger.error('Failed to backfill review reminder flags', { error });
  }

  try {
    const indexed = await rebuildProviderGeoIndex();
    if (indexed > 0) {
      logger.info('Startup provider GEO index ready', { indexed });
    }
  } catch (error) {
    logger.error('Failed to rebuild provider GEO index', { error });
  }
}

export function stopJobs(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export function registerJobs(): void {
  if (interval) return;
  interval = setInterval(() => {
    expirePendingProviderRequests()
      .then((count) => {
        if (count > 0) logger.info('Expired provider booking requests', { count });
      })
      .catch((error) => logger.error('Failed to expire provider requests', { error }));

    expireUrgentRequests()
      .then((count) => {
        if (count > 0) logger.info('Expired urgent requests', { count });
      })
      .catch((error) => logger.error('Failed to expire urgent requests', { error }));

    expireStalePresence()
      .then((count) => {
        if (count > 0) logger.info('Expired stale provider presence', { count });
      })
      .catch((error) => logger.error('Failed to expire stale presence', { error }));

    processPendingInvoicePdfs()
      .then((count) => {
        if (count > 0) logger.info('Generated pending invoice PDFs', { count });
      })
      .catch((error) => logger.error('Failed to process invoice PDFs', { error }));

    cleanupOldLocationHistory()
      .then((count) => {
        if (count > 0) logger.info('Cleaned old location history', { count });
      })
      .catch((error) => logger.error('Failed to clean location history', { error }));

    purgeExpiredChatMessages()
      .then((result) => {
        if (result.supportTickets > 0 || result.assistant > 0) {
          logger.info('Purged expired chat messages', result);
        }
      })
      .catch((error) => logger.error('Failed to purge expired chat messages', { error }));

    refreshMaintenanceScheduleStatuses()
      .then((count) => {
        if (count > 0) logger.info('Refreshed maintenance schedule statuses', { count });
      })
      .catch((error) => logger.error('Failed to refresh maintenance statuses', { error }));

    processMaintenanceReminders()
      .then((count) => {
        if (count > 0) logger.info('Sent maintenance reminders', { count });
      })
      .catch((error) => logger.error('Failed to send maintenance reminders', { error }));

    processWarrantyAlerts()
      .then((count) => {
        if (count > 0) logger.info('Sent warranty alerts', { count });
      })
      .catch((error) => logger.error('Failed to send warranty alerts', { error }));

    expirePendingInvitations()
      .then((count) => {
        if (count > 0) logger.info('Expired home member invitations', { count });
      })
      .catch((error) => logger.error('Failed to expire home invitations', { error }));

    expireVerifications()
      .then((count) => {
        if (count > 0) logger.info('Expired provider verifications', { count });
      })
      .catch((error) => logger.error('Failed to expire verifications', { error }));

    aggregateAllProviderPerformance()
      .then((count) => {
        if (count > 0) logger.info('Aggregated provider performance metrics', { count });
      })
      .catch((error) => logger.error('Failed to aggregate provider performance', { error }));

    detectOperationalSignals()
      .then((count) => {
        if (count > 0) logger.info('Detected operational risk signals', { count });
      })
      .catch((error) => logger.error('Failed to detect operational signals', { error }));

    runPhase10Jobs()
      .then((result) => {
        if (result.recommendations > 0 || result.popularity > 0) {
          logger.info('Ran Phase 10 growth jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 10 jobs', { error }));

    runPhase11Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 11 operations jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 11 jobs', { error }));

    runPhase12Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 12 care plan jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 12 jobs', { error }));

    runPhase13Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 13 organization jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 13 jobs', { error }));

    runPhase14Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 14 intelligence jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 14 jobs', { error }));

    runPhase15Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 15 marketplace jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 15 jobs', { error }));

    runPhase16Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 16 IoT jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 16 jobs', { error }));

    runPhase17Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 17 network jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 17 jobs', { error }));

    runPhase18Jobs()
      .then((result) => {
        if (Object.values(result).some((v) => v > 0)) {
          logger.info('Ran Phase 18 trust jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 18 jobs', { error }));

    runPhase19Jobs()
      .then((result) => {
        if (result.enabled && Object.values(result).some((v) => typeof v === 'number' && v > 0)) {
          logger.info('Ran Phase 19 finance jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 19 jobs', { error }));

    runPhase20Jobs()
      .then((result) => {
        if (result.enabled && Object.values(result).some((v) => typeof v === 'number' && v > 0)) {
          logger.info('Ran Phase 20 lifecycle jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 20 jobs', { error }));

    runPhase21Jobs()
      .then((result) => {
        if (result.enabled && Object.values(result).some((v) => typeof v === 'number' && v > 0)) {
          logger.info('Ran Phase 21 reliability jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 21 jobs', { error }));

    runPhase22Jobs()
      .then((result) => {
        if (result.enabled && Object.values(result).some((v) => typeof v === 'number' && v > 0)) {
          logger.info('Ran Phase 22 security jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 22 jobs', { error }));

    runPhase23Jobs()
      .then((result) => {
        if (result.enabled && Object.values(result).some((v) => typeof v === 'number' && v > 0)) {
          logger.info('Ran Phase 23 performance jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 23 jobs', { error }));

    runPhase24Jobs()
      .then((result) => {
        if (result.enabled && result.regionsProcessed > 0) {
          logger.info('Ran Phase 24 globalization jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Phase 24 jobs', { error }));

    processProviderConfirmationReminders()
      .then((result) => {
        if (result.reminders24h + result.reminders2h + result.replacements > 0) {
          logger.info('Ran provider confirmation jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run provider confirmation jobs', { error }));

    processReviewReminders()
      .then(({ sent }) => {
        if (sent > 0) logger.info('Sent review reminders', { count: sent });
      })
      .catch((error) => logger.error('Failed to send review reminders', { error }));

    runHomeHelpRecurringJobs()
      .then((result) => {
        if (result.occurrences > 0) {
          logger.info('Ran Home Help recurring jobs', result);
        }
      })
      .catch((error) => logger.error('Failed to run Home Help recurring jobs', { error }));
  }, 60_000);

  if (!phase10Initialized) {
    phase10Initialized = true;
    runPhase10Jobs()
      .then((result) => logger.info('Phase 10 jobs initialized', result))
      .catch((error) => logger.error('Failed to initialize Phase 10 jobs', { error }));
  }
}
