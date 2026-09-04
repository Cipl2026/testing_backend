import { Booking } from '@/models/Booking.js';
import { Region, RegionPerformanceSnapshot, DataResidencyPolicy } from '@/models/Globalization.js';
import { RegionLaunchStatus } from '@ghaarfix/shared-types';
import { toMinorUnits } from '@/modules/globalization/money.service.js';

export async function aggregateRegionPerformance(regionId: string): Promise<void> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
  const region = await Region.findById(regionId);
  if (!region) return;

  const bookings = await Booking.find({
    createdAt: { $gte: periodStart, $lte: periodEnd },
    ...(region.cityId ? { 'serviceZoneSnapshot.cityId': region.cityId.toString() } : {}),
  });

  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED');
  const revenueMinor = bookings.reduce(
    (sum, b) => sum + toMinorUnits(b.price?.finalAmount ?? 0, b.price?.currency ?? region.currencyCode),
    0,
  );

  const indicators = {
    demand: bookings.length,
    supply: 0,
    completion: bookings.length > 0 ? completed.length / bookings.length : 0,
    unitEconomics: bookings.length > 0 ? revenueMinor / bookings.length : 0,
    operationalSla: completed.length / Math.max(bookings.length, 1),
    supportReadiness: region.isActive ? 1 : 0,
  };

  await RegionPerformanceSnapshot.create({
    regionId,
    periodStart,
    periodEnd,
    bookings: bookings.length,
    revenueMinor,
    currency: region.currencyCode,
    completionRate: indicators.completion,
    cancellationRate: bookings.length > 0 ? cancelled.length / bookings.length : 0,
    urgentRequests: bookings.filter((b) => Boolean(b.urgentRequestId)).length,
    providerAcceptanceRate: 0,
    indicators,
  });
}

export async function getExpansionAnalytics() {
  const regions = await Region.find().sort({ type: 1, name: 1 });
  const snapshots = await RegionPerformanceSnapshot.find()
    .sort({ periodStart: -1 })
    .limit(regions.length * 2);

  return {
    summary: {
      totalRegions: regions.length,
      activeRegions: regions.filter((r) => r.isActive).length,
      launchingRegions: regions.filter((r) =>
        [RegionLaunchStatus.CONFIGURING, RegionLaunchStatus.READY].includes(r.launchStatus),
      ).length,
      inactiveRegions: regions.filter((r) => !r.isActive).length,
    },
    regions: regions.map((r) => {
      const latest = snapshots.find((s) => s.regionId.toString() === r._id.toString());
      return {
        id: r._id.toString(),
        name: r.name,
        code: r.code,
        type: r.type,
        isActive: r.isActive,
        launchStatus: r.launchStatus,
        indicators: latest?.indicators ?? null,
        bookings: latest?.bookings ?? 0,
        completionRate: latest?.completionRate ?? 0,
      };
    }),
  };
}

export async function listDataResidencyPolicies() {
  return DataResidencyPolicy.find({ isActive: true });
}
