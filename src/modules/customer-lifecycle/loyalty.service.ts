import { LoyaltyEventType, LoyaltyTier } from '@ghaarfix/shared-types';
import { LoyaltyAccount, LoyaltyReward, LoyaltyTransaction } from '@/models/CustomerLifecycle.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0,
  [LoyaltyTier.SILVER]: 500,
  [LoyaltyTier.GOLD]: 2000,
  [LoyaltyTier.PLATINUM]: 5000,
};

function tierForLifetimePoints(points: number): LoyaltyTier {
  if (points >= TIER_THRESHOLDS[LoyaltyTier.PLATINUM]) return LoyaltyTier.PLATINUM;
  if (points >= TIER_THRESHOLDS[LoyaltyTier.GOLD]) return LoyaltyTier.GOLD;
  if (points >= TIER_THRESHOLDS[LoyaltyTier.SILVER]) return LoyaltyTier.SILVER;
  return LoyaltyTier.BRONZE;
}

export async function getOrCreateLoyaltyAccount(customerId: string) {
  return LoyaltyAccount.findOneAndUpdate(
    { customerId },
    { customerId },
    { upsert: true, new: true },
  );
}

export async function creditLoyaltyPoints(input: {
  customerId: string;
  points: number;
  type: LoyaltyEventType;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await LoyaltyTransaction.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;

  const account = await getOrCreateLoyaltyAccount(input.customerId);
  const newBalance = account.points + input.points;
  const lifetime = account.lifetimePoints + Math.max(0, input.points);
  const tier = tierForLifetimePoints(lifetime);

  account.points = newBalance;
  account.lifetimePoints = lifetime;
  account.tier = tier;
  await account.save();

  return LoyaltyTransaction.create({
    accountId: account._id,
    customerId: input.customerId,
    type: input.type,
    points: input.points,
    balanceAfter: newBalance,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
  });
}

export async function redeemLoyaltyReward(customerId: string, rewardId: string, idempotencyKey: string) {
  const existing = await LoyaltyTransaction.findOne({ idempotencyKey });
  if (existing) return existing;

  const reward = await LoyaltyReward.findById(rewardId);
  if (!reward || !reward.available) {
    throw new AppError('Reward not available.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (reward.expiresAt && reward.expiresAt < new Date()) {
    throw new AppError('Reward has expired.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const account = await getOrCreateLoyaltyAccount(customerId);
  if (account.points < reward.pointsCost) {
    throw new AppError('Insufficient loyalty points.', 400, ErrorCode.VALIDATION_ERROR);
  }

  return creditLoyaltyPoints({
    customerId,
    points: -reward.pointsCost,
    type: LoyaltyEventType.REDEEMED,
    idempotencyKey,
    sourceType: 'LoyaltyReward',
    sourceId: rewardId,
    metadata: { rewardName: reward.name },
  });
}

export async function getLoyaltySummary(customerId: string) {
  const account = await getOrCreateLoyaltyAccount(customerId);
  const history = await LoyaltyTransaction.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(50);

  return { account, history };
}

export async function listAvailableRewards() {
  return LoyaltyReward.find({
    available: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  });
}

export async function awardBookingLoyalty(bookingId: string, customerId: string, amountMajor: number) {
  const points = Math.round(amountMajor);
  if (points <= 0) return null;

  return creditLoyaltyPoints({
    customerId,
    points,
    type: LoyaltyEventType.BOOKING_COMPLETED,
    idempotencyKey: `loyalty-booking:${bookingId}`,
    sourceType: 'Booking',
    sourceId: bookingId,
  });
}

export async function expireStaleLoyaltyPoints(): Promise<number> {
  return 0;
}
