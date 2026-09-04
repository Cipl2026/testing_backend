import {
  BookingStatus,
  ErrorCode,
  ReferralCodeStatus,
  ReferralRedemptionStatus,
  RewardLedgerStatus,
  RewardLedgerType,
  RewardSourceType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ReferralCode } from '@/models/ReferralCode.js';
import { ReferralRedemption } from '@/models/ReferralRedemption.js';
import { RewardLedger } from '@/models/RewardLedger.js';
import { Service } from '@/models/Service.js';
import { buildRewardBalanceView, BOOKING_REWARD_COINS, REFERRAL_BOOKING_COINS, REFERRAL_FRIEND_SIGNUP_COINS, REFERRAL_REWARD_COINS } from '@/modules/discovery-growth/reward-coins.js';
import { generateReferralCode } from '@/modules/discovery-growth/hash.util.js';
import { AppError } from '@/utils/AppError.js';

export function computeBookingRewardCoins(_finalAmountMajor: number): number {
  return BOOKING_REWARD_COINS;
}

export async function awardBookingRewardCoins(
  bookingId: string,
  customerId: string,
  finalAmountMajor: number,
) {
  const amount = computeBookingRewardCoins(finalAmountMajor);
  if (amount <= 0) return null;

  return creditRewardIdempotent(
    customerId,
    amount,
    RewardSourceType.LOYALTY,
    bookingId,
    `booking-earn-${bookingId}`,
  );
}

async function creditReferrerForSignup(redemptionId: string, referrerId: string) {
  await creditRewardIdempotent(
    referrerId,
    REFERRAL_REWARD_COINS,
    RewardSourceType.REFERRAL,
    redemptionId,
    `referral-signup-${redemptionId}`,
  );
}

async function creditFriendForSignup(redemptionId: string, referredCustomerId: string) {
  await creditRewardIdempotent(
    referredCustomerId,
    REFERRAL_FRIEND_SIGNUP_COINS,
    RewardSourceType.REFERRAL,
    `${redemptionId}-friend`,
    `referral-friend-signup-${redemptionId}`,
  );
}

export async function awardReferrerBookingCoins(bookingId: string, referredCustomerId: string) {
  const redemption = await ReferralRedemption.findOne({ referredCustomerId });
  if (!redemption) return null;

  return creditRewardIdempotent(
    redemption.referrerId.toString(),
    REFERRAL_BOOKING_COINS,
    RewardSourceType.REFERRAL,
    `${bookingId}-referrer`,
    `referral-booking-${redemption._id.toString()}-${bookingId}`,
  );
}

export async function getOrCreateReferralCode(customerId: string) {
  let code = await ReferralCode.findOne({ customerId });
  if (!code) {
    code = await ReferralCode.create({
      customerId,
      code: generateReferralCode(customerId),
      status: ReferralCodeStatus.ACTIVE,
    });
  }
  return {
    code: code.code,
    status: code.status,
    shareUrl: `https://ghaarfix.in/r/${code.code}`,
  };
}

export async function redeemReferralCode(referredCustomerId: string, code: string) {
  const referralCode = await ReferralCode.findOne({
    code: code.toUpperCase(),
    status: ReferralCodeStatus.ACTIVE,
  });
  if (!referralCode) {
    throw new AppError('Invalid referral code.', 400, ErrorCode.VALIDATION_ERROR);
  }

  if (referralCode.customerId.toString() === referredCustomerId) {
    throw new AppError('You cannot use your own referral code.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const existing = await ReferralRedemption.findOne({ referredCustomerId });
  if (existing) {
    throw new AppError('Referral already redeemed.', 409, ErrorCode.CONFLICT);
  }

  const redemption = await ReferralRedemption.create({
    referrerId: referralCode.customerId,
    referredCustomerId,
    referralCodeId: referralCode._id,
    status: ReferralRedemptionStatus.REWARDED,
    rewardedAt: new Date(),
  });

  await creditReferrerForSignup(redemption._id.toString(), referralCode.customerId.toString());
  await creditFriendForSignup(redemption._id.toString(), referredCustomerId);

  return redemption;
}

export async function processReferralQualifications(bookingId?: string) {
  const filter: Record<string, unknown> = { status: ReferralRedemptionStatus.PENDING };
  if (bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) return 0;
    filter.referredCustomerId = booking.customerId;
  }

  const pending = await ReferralRedemption.find(filter);
  let rewarded = 0;

  for (const redemption of pending) {
    const updated = await ReferralRedemption.findOneAndUpdate(
      { _id: redemption._id, status: ReferralRedemptionStatus.PENDING },
      { status: ReferralRedemptionStatus.REWARDED, rewardedAt: new Date() },
      { new: true },
    );
    if (!updated) continue;

    await creditReferrerForSignup(updated._id.toString(), updated.referrerId.toString());
    await creditFriendForSignup(updated._id.toString(), updated.referredCustomerId.toString());
    rewarded += 1;
  }

  return rewarded;
}

export async function creditRewardIdempotent(
  customerId: string,
  amount: number,
  sourceType: RewardSourceType,
  sourceId: string,
  idempotencyKey: string,
  expiresAt?: Date,
) {
  try {
    return await RewardLedger.create({
      customerId,
      type: RewardLedgerType.CREDIT,
      amount,
      status: RewardLedgerStatus.COMPLETED,
      sourceType,
      sourceId,
      idempotencyKey,
      expiresAt,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return RewardLedger.findOne({ idempotencyKey });
    }
    throw error;
  }
}

export async function getReferralProfile(customerId: string) {
  const referral = await getOrCreateReferralCode(customerId);
  const applied = await ReferralRedemption.findOne({ referredCustomerId: customerId });
  const referralsMade = await ReferralRedemption.countDocuments({ referrerId: customerId });
  const referralsRewarded = await ReferralRedemption.countDocuments({
    referrerId: customerId,
    status: ReferralRedemptionStatus.REWARDED,
  });
  const pendingReferrals = await ReferralRedemption.countDocuments({
    referrerId: customerId,
    status: ReferralRedemptionStatus.PENDING,
  });

  const referralEarnings = await RewardLedger.find({
    customerId,
    sourceType: RewardSourceType.REFERRAL,
    type: RewardLedgerType.CREDIT,
    status: RewardLedgerStatus.COMPLETED,
  });
  const totalEarnedFromReferrals = referralEarnings.reduce((sum, entry) => sum + entry.amount, 0);

  const recentReferrals = await ReferralRedemption.find({ referrerId: customerId })
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    ...referral,
    appliedReferral: applied
      ? {
          status: applied.status,
          qualifiedAt: applied.qualifiedAt?.toISOString(),
          rewardedAt: applied.rewardedAt?.toISOString(),
        }
      : null,
    stats: {
      referralsMade,
      referralsRewarded,
      pendingReferrals,
      totalEarnedFromReferrals,
    },
    recentReferrals: recentReferrals.map((item) => ({
      id: item._id.toString(),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      rewardedAt: item.rewardedAt?.toISOString(),
    })),
  };
}

export { computeCoinRedemption, buildRewardBalanceView, REWARD_COIN_RULE, BOOKING_REWARD_COINS, REFERRAL_REWARD_COINS, REFERRAL_FRIEND_SIGNUP_COINS, REFERRAL_BOOKING_COINS } from '@/modules/discovery-growth/reward-coins.js';

export async function getRewardBalance(customerId: string) {
  const now = new Date();
  const entries = await RewardLedger.find({
    customerId,
    status: RewardLedgerStatus.COMPLETED,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  });

  let balance = 0;
  for (const entry of entries) {
    if (entry.type === RewardLedgerType.CREDIT || entry.type === RewardLedgerType.ADJUSTMENT) {
      balance += entry.amount;
    } else if (entry.type === RewardLedgerType.DEBIT || entry.type === RewardLedgerType.EXPIRATION) {
      balance -= entry.amount;
    }
  }

  return buildRewardBalanceView(Math.max(0, balance));
}

export async function debitRewardIdempotent(
  customerId: string,
  amount: number,
  bookingId: string,
  idempotencyKey: string,
) {
  const balance = await getRewardBalance(customerId);
  if (amount > balance.balance) {
    throw new AppError('Insufficient Ghaarfix coins.', 400, ErrorCode.VALIDATION_ERROR);
  }

  try {
    return await RewardLedger.create({
      customerId,
      type: RewardLedgerType.DEBIT,
      amount,
      status: RewardLedgerStatus.COMPLETED,
      sourceType: RewardSourceType.LOYALTY,
      sourceId: bookingId,
      idempotencyKey,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return RewardLedger.findOne({ idempotencyKey });
    }
    throw error;
  }
}

export async function reverseRewardDebit(customerId: string, bookingId: string, amount: number) {
  const key = `booking-reward-reverse-${bookingId}`;
  try {
    return await RewardLedger.create({
      customerId,
      type: RewardLedgerType.CREDIT,
      amount,
      status: RewardLedgerStatus.COMPLETED,
      sourceType: RewardSourceType.LOYALTY,
      sourceId: bookingId,
      idempotencyKey: key,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return RewardLedger.findOne({ idempotencyKey: key });
    }
    throw error;
  }
}

export async function getRewardLedger(customerId: string, limit = 50) {
  const items = await RewardLedger.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit);
  return items.map((e) => ({
    id: e._id.toString(),
    type: e.type,
    amount: e.amount,
    status: e.status,
    sourceType: e.sourceType,
    expiresAt: e.expiresAt,
    createdAt: e.createdAt,
  }));
}

export async function expireRewards() {
  const now = new Date();
  const expiring = await RewardLedger.find({
    type: RewardLedgerType.CREDIT,
    status: RewardLedgerStatus.COMPLETED,
    expiresAt: { $lte: now },
  });

  let count = 0;
  for (const credit of expiring) {
    const key = `expire-${credit._id}`;
    const existing = await RewardLedger.findOne({ idempotencyKey: key });
    if (existing) continue;

    await RewardLedger.create({
      customerId: credit.customerId,
      type: RewardLedgerType.EXPIRATION,
      amount: credit.amount,
      status: RewardLedgerStatus.COMPLETED,
      sourceType: credit.sourceType,
      sourceId: credit._id.toString(),
      idempotencyKey: key,
    });
    count += 1;
  }
  return count;
}

export async function refreshServicePopularity() {
  const counts = await Booking.aggregate([
    { $match: { status: BookingStatus.COMPLETED } },
    { $group: { _id: '$serviceId', count: { $sum: 1 } } },
  ]);

  let updated = 0;
  for (const row of counts) {
    await Service.updateOne(
      { _id: row._id },
      { $set: { 'metadata.bookingCount': row.count } },
    );
    updated += 1;
  }
  return updated;
}

/** Credits missing booking-earn coins for completed bookings (safe to rerun). */
export async function backfillMissingBookingRewardCoins(customerId?: string) {
  const filter: Record<string, unknown> = { status: BookingStatus.COMPLETED };
  if (customerId) filter.customerId = customerId;

  const bookings = await Booking.find(filter).select('_id customerId price.finalAmount');
  let credited = 0;

  for (const booking of bookings) {
    const bookingId = booking._id.toString();
    const key = `booking-earn-${bookingId}`;
    const existing = await RewardLedger.findOne({ idempotencyKey: key });
    if (existing) continue;

    await awardBookingRewardCoins(
      bookingId,
      booking.customerId.toString(),
      booking.price?.finalAmount ?? 0,
    );
    credited += 1;
  }

  return credited;
}
