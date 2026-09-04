import { BookingStatus, ChurnRiskLevel, CustomerLifecycleState } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { CustomerChurnPrediction, CustomerLifecycleSnapshot } from '@/models/CustomerLifecycle.js';
import { CustomerValueSnapshot } from '@/models/Finance.js';

export async function calculateChurnRisk(customerId: string) {
  const lifecycle = await CustomerLifecycleSnapshot.findOne({ customerId });
  const ltv = await CustomerValueSnapshot.findOne({ customerId });

  const completedBookings = await Booking.countDocuments({
    customerId,
    status: BookingStatus.COMPLETED,
  });

  const lastBooking = await Booking.findOne({
    customerId,
    status: BookingStatus.COMPLETED,
  }).sort({ updatedAt: -1 });

  const factors: string[] = [];
  let riskScore = 0;

  if (lifecycle?.state === CustomerLifecycleState.AT_RISK) {
    riskScore += 40;
    factors.push('Lifecycle state is AT_RISK');
  }
  if (lifecycle?.state === CustomerLifecycleState.CHURNED) {
    riskScore += 70;
    factors.push('No recent booking activity');
  }

  if (lastBooking) {
    const daysSince = Math.floor(
      (Date.now() - lastBooking.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysSince > 120) {
      riskScore += 25;
      factors.push(`Last booking was ${daysSince} days ago`);
    }
  } else if (completedBookings === 0) {
    riskScore += 15;
    factors.push('No completed bookings yet');
  }

  if ((ltv?.repeatRate ?? 0) < 0.2 && completedBookings > 1) {
    riskScore += 15;
    factors.push('Low repeat booking rate');
  }

  let riskLevel = ChurnRiskLevel.LOW;
  if (riskScore >= 60) riskLevel = ChurnRiskLevel.HIGH;
  else if (riskScore >= 30) riskLevel = ChurnRiskLevel.MEDIUM;

  let recommendedAction = 'Continue relevant service reminders.';
  if (riskLevel === ChurnRiskLevel.HIGH) {
    recommendedAction = 'Consider support follow-up and trust recovery; avoid aggressive discounting.';
  } else if (riskLevel === ChurnRiskLevel.MEDIUM) {
    recommendedAction = 'Send personalized maintenance or service reminder based on history.';
  }

  return CustomerChurnPrediction.findOneAndUpdate(
    { customerId },
    {
      customerId,
      riskLevel,
      riskScore: Math.min(100, riskScore),
      confidence: factors.length > 0 ? 0.75 : 0.5,
      topFactors: factors.slice(0, 5),
      recommendedAction,
      modelVersion: 'rule-v1',
      calculatedAt: new Date(),
    },
    { upsert: true, new: true },
  );
}

export async function calculateAllChurnRisks(limit = 100): Promise<number> {
  const customers = await CustomerLifecycleSnapshot.find().limit(limit).select('customerId');
  let count = 0;
  for (const c of customers) {
    await calculateChurnRisk(c.customerId.toString());
    count += 1;
  }
  return count;
}

export async function listChurnPredictions(query: { riskLevel?: ChurnRiskLevel; page?: number; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.riskLevel) filter.riskLevel = query.riskLevel;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    CustomerChurnPrediction.find(filter).sort({ riskScore: -1 }).skip(skip).limit(limit),
    CustomerChurnPrediction.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}
