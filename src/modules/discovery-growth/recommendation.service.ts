import {
  BookingStatus,
  RecommendationSource,
  RecommendationType,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { Home } from '@/models/Home.js';
import { MaintenanceSchedule } from '@/models/MaintenanceSchedule.js';
import { Recommendation } from '@/models/Recommendation.js';
import type { IRecommendation } from '@/models/Recommendation.js';
import { SeasonalCampaignRule } from '@/models/SeasonalCampaignRule.js';
import { Service } from '@/models/Service.js';
import { MaintenanceTemplate } from '@/models/MaintenanceTemplate.js';
import { getHomeInsights } from '@/modules/home-health/insights.service.js';

const DEFAULT_EXPIRY_DAYS = 14;

function expiryDate(days = DEFAULT_EXPIRY_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function listActiveRecommendations(customerId: string, homeId?: string) {
  const now = new Date();
  const filter: Record<string, unknown> = {
    customerId,
    dismissedAt: { $exists: false },
    expiresAt: { $gt: now },
  };
  if (homeId) filter.homeId = homeId;

  const items = await Recommendation.find(filter).sort({ priority: -1, createdAt: -1 }).limit(20);
  return items.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    title: r.title,
    description: r.description,
    reason: r.reason,
    source: r.source,
    action: r.action,
    expiresAt: r.expiresAt,
  }));
}

export async function dismissRecommendation(customerId: string, recommendationId: string) {
  const rec = await Recommendation.findOneAndUpdate(
    { _id: recommendationId, customerId, dismissedAt: { $exists: false } },
    { dismissedAt: new Date() },
    { new: true },
  );
  return rec;
}

export async function clickRecommendation(customerId: string, recommendationId: string) {
  const rec = await Recommendation.findOneAndUpdate(
    { _id: recommendationId, customerId },
    { clickedAt: new Date() },
    { new: true },
  );
  return rec;
}

async function upsertRecommendation(
  customerId: string,
  data: {
    homeId?: string;
    type: RecommendationType;
    title: string;
    description: string;
    reason: string;
    source: RecommendationSource;
    action: IRecommendation['action'];
    priority?: number;
    expiresAt?: Date;
  },
) {
  const filter: Record<string, unknown> = {
    customerId,
    type: data.type,
    dismissedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  };
  if (data.homeId) filter.homeId = data.homeId;
  if (data.action.serviceId) filter['action.serviceId'] = data.action.serviceId;

  await Recommendation.findOneAndUpdate(
    filter,
    {
      $set: {
        ...data,
        priority: data.priority ?? 0,
        expiresAt: data.expiresAt ?? expiryDate(),
      },
    },
    { upsert: true, new: true },
  );
}

export async function generateRecommendationsForCustomer(customerId: string) {
  const homes = await Home.find({ ownerId: customerId });
  const homeIds = homes.map((h) => h._id);

  for (const home of homes) {
    const { insights } = await getHomeInsights(customerId, home._id.toString());
    for (const insight of insights) {
      if (!insight.assetId) continue;
      const asset = await HomeAsset.findById(insight.assetId);
      if (!asset) continue;
      const template = await MaintenanceTemplate.findOne({
        assetTypeId: asset.assetTypeId,
        isActive: true,
      });
      if (!template) continue;
      const service = await Service.findById(template.serviceId);
      if (!service?.isActive) continue;

      await upsertRecommendation(customerId, {
        homeId: home._id.toString(),
        type: RecommendationType.MAINTENANCE,
        title: insight.title,
        description: insight.message,
        reason: `Recommended because ${insight.message}`,
        source: RecommendationSource.HOME_HEALTH,
        action: { type: 'BOOK_SERVICE', serviceId: service._id, assetId: asset._id },
        priority: 90,
      });
    }
  }

  const completedBookings = await Booking.find({
    customerId,
    status: BookingStatus.COMPLETED,
  })
    .sort({ updatedAt: -1 })
    .limit(5);

  for (const booking of completedBookings) {
    await upsertRecommendation(customerId, {
      homeId: booking.homeId?.toString(),
      type: RecommendationType.REBOOK,
      title: `Book ${booking.serviceSnapshot.name} again`,
      description: 'Quickly rebook your previous service.',
      reason: `You booked ${booking.serviceSnapshot.name} recently.`,
      source: RecommendationSource.BOOKING_HISTORY,
      action: { type: 'REBOOK', serviceId: booking.serviceId, bookingId: booking._id },
      priority: 80,
    });
  }

  const now = new Date();
  const seasonalRules = await SeasonalCampaignRule.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ priority: -1 });

  for (const rule of seasonalRules) {
    for (const serviceId of rule.serviceIds) {
      const service = await Service.findById(serviceId);
      if (!service?.isActive) continue;
      await upsertRecommendation(customerId, {
        type: RecommendationType.SEASONAL,
        title: rule.name,
        description: rule.message,
        reason: `Seasonal recommendation: ${rule.message}`,
        source: RecommendationSource.SEASON,
        action: { type: 'BOOK_SERVICE', serviceId: service._id },
        priority: rule.priority,
        expiresAt: rule.endDate,
      });
    }
  }

  const popularServices = await Service.find({ isActive: true })
    .sort({ 'metadata.bookingCount': -1, displayOrder: 1 })
    .limit(5);

  for (const service of popularServices) {
    await upsertRecommendation(customerId, {
      type: RecommendationType.POPULAR,
      title: service.name,
      description: service.shortDescription ?? 'Popular service in your area.',
      reason: 'Popular among GhaarFix customers.',
      source: RecommendationSource.POPULARITY,
      action: { type: 'BOOK_SERVICE', serviceId: service._id },
      priority: 50,
    });
  }

  const assets = await HomeAsset.find({ homeId: { $in: homeIds }, archivedAt: null });
  for (const asset of assets) {
    const template = await MaintenanceTemplate.findOne({
      assetTypeId: asset.assetTypeId,
      isActive: true,
    });
    if (!template) continue;
    const service = await Service.findById(template.serviceId);
    if (!service?.isActive) continue;
    await upsertRecommendation(customerId, {
      homeId: asset.homeId.toString(),
      type: RecommendationType.ASSET,
      title: `Service for ${asset.name}`,
      description: `Recommended service for your ${asset.name}.`,
      reason: `Based on your registered ${asset.name} asset.`,
      source: RecommendationSource.HOME_HEALTH,
      action: { type: 'BOOK_SERVICE', serviceId: service._id, assetId: asset._id },
      priority: 70,
    });
  }

  await MaintenanceSchedule.find({ homeId: { $in: homeIds } });
}

export async function generateRecommendationsForCustomers() {
  const customerIds = await Booking.distinct('customerId', { status: BookingStatus.COMPLETED });
  let count = 0;
  for (const customerId of customerIds) {
    await generateRecommendationsForCustomer(customerId.toString());
    count += 1;
  }
  return count;
}

export async function expireRecommendations() {
  const result = await Recommendation.deleteMany({ expiresAt: { $lte: new Date() } });
  return result.deletedCount ?? 0;
}
