import {
  BookingContextType,
  OrganizationMaintenanceStatus,
  OrganizationPermission,
  PropertyHealthStatus,
  SLAStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ManagedProperty, PropertyHealthScore } from '@/models/ManagedProperty.js';
import {
  OrganizationBudget,
  OrganizationMaintenanceSchedule,
  SLATracker,
} from '@/models/OrganizationOperations.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';

export async function getOrganizationAnalytics(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);

  const [
    propertyCount,
    openJobs,
    monthlySpendAgg,
    slaCompliance,
    upcomingMaintenance,
    budgets,
    healthScores,
  ] = await Promise.all([
    ManagedProperty.countDocuments({ organizationId, status: 'ACTIVE' }),
    Booking.countDocuments({
      organizationId,
      bookingContextType: BookingContextType.ORGANIZATION,
      status: { $in: ['PENDING_PROVIDER', 'CONFIRMED', 'IN_PROGRESS', 'PROVIDER_EN_ROUTE'] },
    }),
    Booking.aggregate([
      {
        $match: {
          organizationId: organizationId as unknown as import('mongoose').Types.ObjectId,
          bookingContextType: BookingContextType.ORGANIZATION,
          createdAt: { $gte: new Date(new Date().setDate(1)) },
        },
      },
      { $group: { _id: null, total: { $sum: '$price.finalAmount' } } },
    ]),
    SLATracker.aggregate([
      { $match: { organizationId: organizationId as unknown as import('mongoose').Types.ObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    OrganizationMaintenanceSchedule.find({
      organizationId,
      status: OrganizationMaintenanceStatus.ACTIVE,
      nextDueAt: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    }).limit(10),
    OrganizationBudget.find({ organizationId }).sort({ periodStart: -1 }).limit(5),
    PropertyHealthScore.find({ organizationId }),
  ]);

  const monthlySpend = monthlySpendAgg[0]?.total ?? 0;
  const slaTotal = slaCompliance.reduce((s: number, r: { count: number }) => s + r.count, 0);
  const slaOnTrack =
    slaCompliance.find((r: { _id: string }) => r._id === SLAStatus.ON_TRACK)?.count ?? 0;

  return {
    totalProperties: propertyCount,
    openJobs,
    monthlySpend,
    slaComplianceRate: slaTotal > 0 ? Math.round((slaOnTrack / slaTotal) * 100) : 100,
    upcomingMaintenance: upcomingMaintenance.map((m) => ({
      id: m._id.toString(),
      propertyId: m.propertyId.toString(),
      nextDueAt: m.nextDueAt,
    })),
    budgetUsage: budgets.map((b) => ({
      id: b._id.toString(),
      totalBudget: b.totalBudget,
      usedBudget: b.usedBudget,
      reservedBudget: b.reservedBudget,
      utilization: b.totalBudget > 0 ? Math.round((b.usedBudget / b.totalBudget) * 100) : 0,
    })),
    propertyHealth: healthScores.map((h) => ({
      propertyId: h.propertyId.toString(),
      score: h.score,
      status: h.status,
      reasons: h.reasons,
    })),
  };
}

export async function calculatePropertyHealthScores(organizationId?: string) {
  const filter = organizationId ? { organizationId } : {};
  const properties = await ManagedProperty.find({ ...filter, status: 'ACTIVE' });

  let updated = 0;
  for (const property of properties) {
    const overdueMaintenance = await OrganizationMaintenanceSchedule.countDocuments({
      propertyId: property._id,
      status: OrganizationMaintenanceStatus.ACTIVE,
      nextDueAt: { $lt: new Date() },
    });

    const openCritical = await Booking.countDocuments({
      managedPropertyId: property._id,
      status: { $in: ['PENDING_PROVIDER', 'CONFIRMED', 'IN_PROGRESS'] },
    });

    const slaBreaches = await SLATracker.countDocuments({
      organizationId: property.organizationId,
      bookingId: {
        $in: (
          await Booking.find({ managedPropertyId: property._id }).select('_id')
        ).map((b) => b._id),
      },
      status: SLAStatus.BREACHED,
    });

    const reasons: string[] = [];
    if (overdueMaintenance > 0) reasons.push(`${overdueMaintenance} overdue maintenance tasks`);
    if (openCritical > 3) reasons.push(`${openCritical} open work orders`);
    if (slaBreaches > 0) reasons.push(`${slaBreaches} SLA breaches`);

    let status = PropertyHealthStatus.HEALTHY;
    let score = 90;
    if (overdueMaintenance > 0 || openCritical > 2) {
      status = PropertyHealthStatus.ATTENTION;
      score = 70;
    }
    if (overdueMaintenance > 2 || slaBreaches > 0) {
      status = PropertyHealthStatus.AT_RISK;
      score = 45;
    }
    if (overdueMaintenance > 5 || slaBreaches > 2) {
      status = PropertyHealthStatus.CRITICAL;
      score = 20;
    }

    await PropertyHealthScore.findOneAndUpdate(
      { propertyId: property._id },
      {
        organizationId: property.organizationId,
        score,
        status,
        reasons,
        calculatedAt: new Date(),
      },
      { upsert: true },
    );
    updated += 1;
  }
  return updated;
}
