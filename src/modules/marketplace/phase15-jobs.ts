import { expireStaleReservations } from '@/modules/marketplace/inventory.service.js';
import { runMonthlySettlements } from '@/modules/marketplace/settlement.service.js';
import { sendWarrantyReminders } from '@/modules/marketplace/warranty.service.js';
import { logger } from '@/utils/logger.js';

export async function runPhase15Jobs() {
  const [expiredReservations, warrantyReminders, settlements] = await Promise.all([
    expireStaleReservations().catch((e) => {
      logger.error('Phase15 reservation expiry failed', { error: e });
      return 0;
    }),
    sendWarrantyReminders().catch((e) => {
      logger.error('Phase15 warranty reminders failed', { error: e });
      return 0;
    }),
    runMonthlySettlements().catch((e) => {
      logger.error('Phase15 settlements failed', { error: e });
      return 0;
    }),
  ]);

  return { expiredReservations, warrantyReminders, settlements };
}
