import {
  SupplyAlert,
  ZoneCapacitySnapshot,
  CoverageGap,
} from '@/models/Network.js';
import { SupplyAlertSeverity, SupplyAlertStatus } from '@ghaarfix/shared-types';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { SupplyDemandStatus } from '@ghaarfix/shared-types';

export async function createSupplyAlertIfNeeded(zoneId: string, serviceId: string) {
  const analysis = await analyzeZoneSupplyDemand(zoneId, serviceId);
  if (analysis.status !== SupplyDemandStatus.CRITICAL && analysis.status !== SupplyDemandStatus.CONSTRAINED) {
    return null;
  }

  const dedupeKey = `alert:${zoneId}:${serviceId}:${new Date().toISOString().slice(0, 13)}`;
  const existing = await SupplyAlert.findOne({ dedupeKey });
  if (existing) return existing;

  const severity =
    analysis.status === SupplyDemandStatus.CRITICAL
      ? SupplyAlertSeverity.CRITICAL
      : SupplyAlertSeverity.HIGH;

  return SupplyAlert.create({
    scope: `zone:${zoneId}:service:${serviceId}`,
    zoneId,
    serviceId,
    severity,
    title: 'Capacity at risk',
    details: `${analysis.explanation} Ratio: ${analysis.supplyDemandRatio}`,
    recommendedAction: 'Review recruitment priorities or extend provider shifts.',
    status: SupplyAlertStatus.OPEN,
    dedupeKey,
  });
}

export async function getNetworkOverview() {
  const [snapshots, openGaps, openAlerts, criticalSnapshots] = await Promise.all([
    ZoneCapacitySnapshot.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    CoverageGap.countDocuments({ status: 'OPEN' }),
    SupplyAlert.countDocuments({ status: SupplyAlertStatus.OPEN }),
    ZoneCapacitySnapshot.countDocuments({ supplyStatus: SupplyDemandStatus.CRITICAL }),
  ]);

  const recentSnapshots = await ZoneCapacitySnapshot.find()
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    snapshots24h: snapshots,
    openCoverageGaps: openGaps,
    openSupplyAlerts: openAlerts,
    criticalZones: criticalSnapshots,
    recentCapacity: recentSnapshots.map((s) => ({
      zoneId: s.zoneId.toString(),
      serviceId: s.serviceId.toString(),
      supplyStatus: s.supplyStatus,
      ratio: s.supplyDemandRatio,
      timeBucket: s.timeBucket,
    })),
  };
}

export async function listSupplyAlerts(query: { limit?: number }) {
  const items = await SupplyAlert.find({ status: SupplyAlertStatus.OPEN })
    .sort({ severity: -1, createdAt: -1 })
    .limit(query.limit ?? 20);

  return items.map((a) => ({
    id: a._id.toString(),
    scope: a.scope,
    zoneId: a.zoneId?.toString(),
    serviceId: a.serviceId?.toString(),
    severity: a.severity,
    title: a.title,
    details: a.details,
    recommendedAction: a.recommendedAction,
    status: a.status,
    createdAt: a.createdAt,
  }));
}
