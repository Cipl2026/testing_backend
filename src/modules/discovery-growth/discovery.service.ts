import { BookingStatus } from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Service } from '@/models/Service.js';
import * as recommendationService from '@/modules/discovery-growth/recommendation.service.js';
import { SeasonalCampaignRule } from '@/models/SeasonalCampaignRule.js';
import { FavoriteService } from '@/models/FavoriteService.js';
import * as rebookingService from '@/modules/discovery-growth/rebooking.service.js';

async function safeSection<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    return { error: `${label} unavailable` };
  }
}

export async function getHomeDiscovery(customerId: string, homeId?: string, region?: string) {
  const now = new Date();
  const seasonalFilter: Record<string, unknown> = {
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  };
  if (region) {
    seasonalFilter.$or = [{ regions: { $size: 0 } }, { regions: region }];
  }

  const [recommended, bookAgain, recentlyUsed, seasonal, saved] = await Promise.all([
    safeSection('recommended', () => recommendationService.listActiveRecommendations(customerId, homeId)),
    safeSection('bookAgain', () => getBookAgainSection(customerId)),
    safeSection('recentlyUsed', () => getRecentlyUsed(customerId)),
    safeSection('seasonal', async () => {
      const rules = await SeasonalCampaignRule.find(seasonalFilter).sort({ priority: -1 }).limit(3);
      return rules.map((r) => ({
        id: r._id.toString(),
        name: r.name,
        message: r.message,
        serviceIds: r.serviceIds.map((id) => id.toString()),
      }));
    }),
    safeSection('saved', async () => {
      const favorites = await FavoriteService.find({ customerId }).sort({ createdAt: -1 }).limit(10);
      const services = await Service.find({ _id: { $in: favorites.map((f) => f.serviceId) }, isActive: true });
      return services.map((s) => ({ id: s._id.toString(), name: s.name, slug: s.slug }));
    }),
  ]);

  return {
    recommended,
    bookAgain,
    recentlyUsed,
    seasonal,
    saved,
  };
}

async function getBookAgainSection(customerId: string) {
  const bookings = await Booking.find({ customerId, status: BookingStatus.COMPLETED })
    .sort({ updatedAt: -1 })
    .limit(5);
  return bookings.map((b) => ({
    bookingId: b._id.toString(),
    serviceName: b.serviceSnapshot.name,
    serviceId: b.serviceId.toString(),
    homeId: b.homeId?.toString(),
  }));
}

async function getRecentlyUsed(customerId: string) {
  const bookings = await Booking.find({ customerId, status: BookingStatus.COMPLETED })
    .sort({ updatedAt: -1 })
    .limit(10);
  const seen = new Set<string>();
  const items: Array<{ serviceId: string; name: string }> = [];
  for (const booking of bookings) {
    const id = booking.serviceId.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ serviceId: id, name: booking.serviceSnapshot.name });
  }
  return items.slice(0, 10);
}

export { rebookingService };
