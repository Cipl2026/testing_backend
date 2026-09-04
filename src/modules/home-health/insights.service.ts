import {
  AssetHealthStatus,
  HomeHealthOverallStatus,
  InsightType,
  MaintenanceScheduleStatus,
  WarrantyStatus,
} from '@ghaarfix/shared-types';
import { AssetServiceRecord } from '@/models/AssetServiceRecord.js';
import { AssetType } from '@/models/AssetType.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { MaintenanceSchedule } from '@/models/MaintenanceSchedule.js';
import { Warranty } from '@/models/Warranty.js';
import { getOwnedHome } from '@/modules/home-health/helpers.js';
import { computeAssetHealth } from '@/modules/home-health/asset.service.js';
import { refreshMaintenanceScheduleStatuses } from '@/modules/home-health/maintenance.service.js';

export async function getHomeHealth(customerId: string, homeId: string) {
  await getOwnedHome(customerId, homeId);
  await refreshMaintenanceScheduleStatuses();

  const assets = await HomeAsset.find({ homeId, archivedAt: null });
  const attentionItems: Array<{
    assetId: string;
    name: string;
    assetTypeName?: string;
    status: AssetHealthStatus;
    reason: string;
  }> = [];

  for (const asset of assets) {
    const health = await computeAssetHealth(asset._id.toString());
    if (health.status !== AssetHealthStatus.GOOD) {
      const assetType = await AssetType.findById(asset.assetTypeId);
      attentionItems.push({
        assetId: asset._id.toString(),
        name: assetType?.name ?? asset.name,
        assetTypeName: assetType?.name,
        status: health.status,
        reason: health.reason ?? 'Needs attention',
      });
    }
  }

  const [maintenanceDue, warrantyExpiring] = await Promise.all([
    MaintenanceSchedule.countDocuments({
      homeId,
      status: { $in: [MaintenanceScheduleStatus.DUE, MaintenanceScheduleStatus.OVERDUE] },
    }),
    Warranty.countDocuments({
      assetId: { $in: assets.map((a) => a._id) },
      status: WarrantyStatus.EXPIRING,
    }),
  ]);

  const overallStatus =
    attentionItems.length === 0
      ? HomeHealthOverallStatus.GOOD
      : HomeHealthOverallStatus.NEEDS_ATTENTION;

  const assetCount = assets.length || 1;
  const healthyAssets = assets.length - attentionItems.length;
  const maintenancePenalty = Math.min(maintenanceDue * 8, 30);
  const warrantyPenalty = Math.min(warrantyExpiring * 5, 15);
  const attentionPenalty = Math.min(attentionItems.length * 12, 40);
  const healthScore = Math.max(
    30,
    Math.min(
      100,
      Math.round(
        (healthyAssets / assetCount) * 100 - maintenancePenalty - warrantyPenalty - attentionPenalty,
      ),
    ),
  );

  return {
    overallStatus,
    healthScore,
    attentionCount: attentionItems.length,
    summary:
      attentionItems.length === 0
        ? 'Everything looks good'
        : `${attentionItems.length} item${attentionItems.length > 1 ? 's' : ''} need attention`,
    maintenanceDueCount: maintenanceDue,
    warrantyExpiringCount: warrantyExpiring,
    attentionItems,
  };
}

export async function getHomeInsights(customerId: string, homeId: string) {
  await getOwnedHome(customerId, homeId);
  const assets = await HomeAsset.find({ homeId, archivedAt: null });
  const insights: Array<{ type: InsightType; title: string; message: string; assetId?: string }> = [];

  for (const asset of assets) {
    const health = await computeAssetHealth(asset._id.toString());
    if (health.status === AssetHealthStatus.MAINTENANCE_DUE) {
      insights.push({
        type: InsightType.MAINTENANCE_DUE,
        title: `${asset.name} maintenance`,
        message: health.reason ?? 'Maintenance is due.',
        assetId: asset._id.toString(),
      });
    }
    if (health.status === AssetHealthStatus.WARRANTY_EXPIRING) {
      insights.push({
        type: InsightType.WARRANTY_EXPIRING,
        title: `${asset.name} warranty`,
        message: health.reason ?? 'Warranty expiring soon.',
        assetId: asset._id.toString(),
      });
    }
    if (health.status === AssetHealthStatus.ATTENTION_NEEDED) {
      insights.push({
        type: InsightType.LONG_UNSERVICED,
        title: `${asset.name} service`,
        message: health.reason ?? 'Long time since last service.',
        assetId: asset._id.toString(),
      });
    }

    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const repairCount = await AssetServiceRecord.countDocuments({
      assetId: asset._id,
      performedAt: { $gte: twelveMonthsAgo },
    });
    if (repairCount >= 3) {
      const recentCost = await AssetServiceRecord.aggregate([
        { $match: { assetId: asset._id, performedAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: null, total: { $sum: '$cost' } } },
      ]);
      insights.push({
        type: InsightType.REPEATED_REPAIRS,
        title: `${asset.name} repairs`,
        message: `Repeated repairs detected (${repairCount} in 12 months, ₹${recentCost[0]?.total ?? 0}). You may want to compare future repair costs with replacement options.`,
        assetId: asset._id.toString(),
      });
    }
  }

  return { insights };
}
