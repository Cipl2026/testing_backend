import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { backfillMissingBookingRewardCoins } from '@/modules/discovery-growth/growth.service.js';
import { logger } from '@/utils/logger.js';

const customerId = process.argv[2];

async function main() {
  await connectDatabase();
  const credited = await backfillMissingBookingRewardCoins(customerId);
  logger.info('Backfill complete', { credited, customerId: customerId ?? 'all' });
  await disconnectDatabase();
}

void main().catch(async (err) => {
  logger.error('Backfill failed', { error: String(err) });
  await disconnectDatabase();
  process.exit(1);
});
