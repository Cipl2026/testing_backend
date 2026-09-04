import { ReferralRedemption } from '@/models/ReferralRedemption.js';
import { ReferralReviewStatus } from '@ghaarfix/shared-types';
import { ReferralReview } from '@/models/CustomerLifecycle.js';

export async function reviewReferralFraud(): Promise<number> {
  const recent = await ReferralRedemption.find().sort({ createdAt: -1 }).limit(100);
  let flagged = 0;

  for (const redemption of recent) {
    if (redemption.referrerId.toString() === redemption.referredCustomerId.toString()) {
      await upsertReferralReview(redemption._id.toString(), ['SELF_REFERRAL']);
      flagged += 1;
      continue;
    }

    const sameReferrerCount = await ReferralRedemption.countDocuments({
      referrerId: redemption.referrerId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    if (sameReferrerCount > 10) {
      await upsertReferralReview(redemption._id.toString(), ['HIGH_VOLUME_REFERRALS']);
      flagged += 1;
    }
  }

  return flagged;
}

async function upsertReferralReview(redemptionId: string, flags: string[]) {
  const existing = await ReferralReview.findOne({ referralRedemptionId: redemptionId });
  if (existing) return existing;

  return ReferralReview.create({
    referralRedemptionId: redemptionId,
    status: ReferralReviewStatus.FLAGGED,
    flags,
    notes: 'Automated fraud signal — requires human review before rejection.',
  });
}

export async function listReferralReviews() {
  return ReferralReview.find().sort({ createdAt: -1 }).limit(50);
}
