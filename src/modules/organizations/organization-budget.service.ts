import { ErrorCode, OrganizationBudgetPeriod, OrganizationPermission } from '@ghaarfix/shared-types';
import { DateTime } from 'luxon';
import { OrganizationBudget } from '@/models/OrganizationOperations.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { AppError } from '@/utils/AppError.js';

function availableBudget(budget: InstanceType<typeof OrganizationBudget>) {
  return Math.max(0, budget.totalBudget - budget.usedBudget - budget.reservedBudget);
}

export async function getOrCreateCurrentBudget(organizationId: string, propertyId?: string) {
  const now = new Date();
  let budget = await OrganizationBudget.findOne({
    organizationId,
    propertyId: propertyId ?? { $exists: false },
    periodStart: { $lte: now },
    periodEnd: { $gte: now },
  });

  if (!budget) {
    const start = DateTime.now().startOf('month').toJSDate();
    const end = DateTime.now().endOf('month').toJSDate();
    budget = await OrganizationBudget.create({
      organizationId,
      propertyId,
      period: OrganizationBudgetPeriod.MONTHLY,
      periodStart: start,
      periodEnd: end,
      totalBudget: 1_000_000,
      usedBudget: 0,
      reservedBudget: 0,
      currency: 'INR',
    });
  }
  return budget;
}

export async function reserveBudget(
  organizationId: string,
  amount: number,
  propertyId?: string,
) {
  const budget = await getOrCreateCurrentBudget(organizationId, propertyId);
  const updated = await OrganizationBudget.findOneAndUpdate(
    {
      _id: budget._id,
      $expr: {
        $gte: [
          { $subtract: ['$totalBudget', { $add: ['$usedBudget', '$reservedBudget'] }] },
          amount,
        ],
      },
    },
    { $inc: { reservedBudget: amount } },
    { new: true },
  );
  if (!updated) throw new AppError('Insufficient budget.', 409, ErrorCode.CONFLICT);
  return updated;
}

export async function settleBudget(
  organizationId: string,
  reservedAmount: number,
  actualAmount: number,
  propertyId?: string,
) {
  const budget = await getOrCreateCurrentBudget(organizationId, propertyId);
  const releaseDelta = reservedAmount - actualAmount;
  await OrganizationBudget.findOneAndUpdate(
    { _id: budget._id, reservedBudget: { $gte: reservedAmount } },
    {
      $inc: {
        reservedBudget: -reservedAmount,
        usedBudget: actualAmount,
      },
    },
  );
  if (releaseDelta > 0) {
    // over-reserved amount returned to available pool via reservedBudget decrease above
  }
}

export async function releaseBudgetReservation(
  organizationId: string,
  amount: number,
  propertyId?: string,
) {
  const budget = await getOrCreateCurrentBudget(organizationId, propertyId);
  await OrganizationBudget.findOneAndUpdate(
    { _id: budget._id, reservedBudget: { $gte: amount } },
    { $inc: { reservedBudget: -amount } },
  );
}

export async function listBudgets(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_FINANCE);
  const budgets = await OrganizationBudget.find({ organizationId }).sort({ periodStart: -1 });
  return budgets.map((b) => ({
    id: b._id.toString(),
    propertyId: b.propertyId?.toString(),
    period: b.period,
    totalBudget: b.totalBudget,
    usedBudget: b.usedBudget,
    reservedBudget: b.reservedBudget,
    available: availableBudget(b),
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
  }));
}

export async function upsertBudget(
  userId: string,
  organizationId: string,
  input: {
    propertyId?: string;
    period: OrganizationBudgetPeriod;
    periodStart: Date;
    periodEnd: Date;
    totalBudget: number;
  },
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_BILLING);
  const budget = await OrganizationBudget.create({
    organizationId,
    propertyId: input.propertyId,
    period: input.period,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalBudget: input.totalBudget,
    usedBudget: 0,
    reservedBudget: 0,
  });
  return {
    id: budget._id.toString(),
    totalBudget: budget.totalBudget,
    available: availableBudget(budget),
  };
}
