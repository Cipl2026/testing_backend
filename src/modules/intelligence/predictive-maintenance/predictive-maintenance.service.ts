import {
  PredictiveMaintenanceRisk,
  IntelligenceFeature,
} from '@ghaarfix/shared-types';
import { AssetServiceRecord } from '@/models/AssetServiceRecord.js';
import { AssetType } from '@/models/AssetType.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { MaintenanceSchedule } from '@/models/MaintenanceSchedule.js';
import { MaintenanceTemplate } from '@/models/MaintenanceTemplate.js';
import { getOwnedHome } from '@/modules/home-health/helpers.js';
import { assertIntelligenceFeatureEnabled } from '@/modules/intelligence/intelligence-usage.service.js';

const MAINTENANCE_MONTHS_THRESHOLD = Number(process.env.PREDICTIVE_MAINTENANCE_MONTHS ?? 12);
const REPAIR_COUNT_THRESHOLD = Number(process.env.PREDICTIVE_REPAIR_COUNT_THRESHOLD ?? 2);
const REPAIR_WINDOW_MONTHS = 6;

export interface PredictiveMaintenanceInsight {
  assetId: string;
  /** Display name — asset type (e.g. Air Conditioner), not room label */
  assetName: string;
  assetLabel?: string;
  assetTypeName?: string;
  assetTypeSlug?: string;
  risk: PredictiveMaintenanceRisk;
  reason: string;
  recommendedServiceWindow?: string;
  serviceId?: string;
  explanation: string;
}

function monthsSince(date: Date | undefined): number {
  if (!date) return 999;
  return (Date.now() - date.getTime()) / (30 * 24 * 60 * 60 * 1000);
}

async function loadAssetContext(asset: InstanceType<typeof HomeAsset>) {
  const assetType = await AssetType.findById(asset.assetTypeId);
  const template = await MaintenanceTemplate.findOne({
    assetTypeId: asset.assetTypeId,
    isActive: true,
  }).sort({ updatedAt: -1 });
  const typeName = assetType?.name ?? 'Asset';
  const typeSlug = assetType?.slug;
  const displayName = typeName;
  const label = asset.name !== typeName ? asset.name : undefined;
  return {
    assetType,
    typeName,
    typeSlug,
    displayName,
    label,
    serviceId: template?.serviceId?.toString(),
  };
}

async function assessAsset(asset: InstanceType<typeof HomeAsset>): Promise<PredictiveMaintenanceInsight | null> {
  const ctx = await loadAssetContext(asset);
  const subject = ctx.displayName;

  const sixMonthsAgo = new Date(Date.now() - REPAIR_WINDOW_MONTHS * 30 * 24 * 60 * 60 * 1000);
  const repairCount = await AssetServiceRecord.countDocuments({
    assetId: asset._id,
    performedAt: { $gte: sixMonthsAgo },
  });

  const overdueMaintenance = await MaintenanceSchedule.countDocuments({
    assetId: asset._id,
    status: 'OVERDUE',
  });

  const lastService = await AssetServiceRecord.findOne({ assetId: asset._id }).sort({
    performedAt: -1,
  });
  const monthsSinceService = monthsSince(lastService?.performedAt);

  const base = {
    assetId: asset._id.toString(),
    assetName: subject,
    assetLabel: ctx.label,
    assetTypeName: ctx.typeName,
    assetTypeSlug: ctx.typeSlug,
    serviceId: ctx.serviceId,
  };

  if (repairCount >= REPAIR_COUNT_THRESHOLD) {
    return {
      ...base,
      risk: PredictiveMaintenanceRisk.HIGH,
      reason: `${repairCount} services in the last ${REPAIR_WINDOW_MONTHS} months`,
      recommendedServiceWindow: 'Within 2 weeks',
      explanation: `Your ${subject} has required service ${repairCount} times in the last ${REPAIR_WINDOW_MONTHS} months. Book a ${subject.toLowerCase()} service soon.`,
    };
  }

  if (overdueMaintenance > 0) {
    return {
      ...base,
      risk: PredictiveMaintenanceRisk.HIGH,
      reason: 'Overdue maintenance schedule',
      recommendedServiceWindow: 'As soon as possible',
      explanation: `Your ${subject} has overdue maintenance. Book a service to avoid breakdowns.`,
    };
  }

  if (monthsSinceService > MAINTENANCE_MONTHS_THRESHOLD) {
    return {
      ...base,
      risk: PredictiveMaintenanceRisk.MEDIUM,
      reason: `No maintenance for ${Math.floor(monthsSinceService)} months`,
      recommendedServiceWindow: 'Within 30 days',
      explanation: `Your ${subject} may need maintenance — last service was over ${MAINTENANCE_MONTHS_THRESHOLD} months ago.`,
    };
  }

  const assetAgeMonths = monthsSince(asset.purchaseDate ?? asset.createdAt);
  if (assetAgeMonths > 36 && monthsSinceService > 6) {
    return {
      ...base,
      risk: PredictiveMaintenanceRisk.MEDIUM,
      reason: 'Aging asset without recent service',
      recommendedServiceWindow: 'Within 60 days',
      explanation: `Your ${subject} is aging and has not been serviced recently.`,
    };
  }

  return null;
}

export async function getHomePredictiveMaintenance(
  customerId: string,
  homeId: string,
): Promise<PredictiveMaintenanceInsight[]> {
  await assertIntelligenceFeatureEnabled(IntelligenceFeature.PREDICTIVE_MAINTENANCE, customerId);
  await getOwnedHome(customerId, homeId);

  const assets = await HomeAsset.find({ homeId, archivedAt: null });
  const insights: PredictiveMaintenanceInsight[] = [];

  for (const asset of assets) {
    const insight = await assessAsset(asset);
    if (insight) insights.push(insight);
  }

  return insights.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.risk] - order[b.risk];
  });
}

export async function getAssetPredictiveMaintenance(customerId: string, assetId: string) {
  await assertIntelligenceFeatureEnabled(IntelligenceFeature.PREDICTIVE_MAINTENANCE, customerId);
  const asset = await HomeAsset.findById(assetId);
  if (!asset) return null;
  await getOwnedHome(customerId, asset.homeId.toString());
  return assessAsset(asset);
}
