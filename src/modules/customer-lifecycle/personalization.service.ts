import {
  BookingStatus,
  MarketingChannel,
  MessagePriority,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Service } from '@/models/Service.js';
import { getCustomerLifecycle } from '@/modules/customer-lifecycle/lifecycle.service.js';
import {
  generateServiceRecommendations,
  listServiceRecommendations,
} from '@/modules/customer-lifecycle/service-recommendation.service.js';
import { getOrCreateConsent } from '@/modules/customer-lifecycle/consent.service.js';
import { CustomerChurnPrediction } from '@/models/CustomerLifecycle.js';

export type ForYouCarouselItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  subtitle: string;
  reason: string;
  whyAmISeeingThis: string;
  source: string;
  imageUrl?: string;
  badge?: string;
  bookingCount?: number;
  lastBookedAt?: string;
};

async function buildForYouCarousel(customerId: string): Promise<ForYouCarouselItem[]> {
  const items: ForYouCarouselItem[] = [];
  const seenServiceIds = new Set<string>();

  const addItem = (item: ForYouCarouselItem) => {
    if (seenServiceIds.has(item.serviceId)) return;
    seenServiceIds.add(item.serviceId);
    items.push(item);
  };

  let recommendations = await listServiceRecommendations(customerId);
  if (recommendations.length === 0) {
    await generateServiceRecommendations(customerId);
    recommendations = await listServiceRecommendations(customerId);
  }

  for (const rec of recommendations) {
    const service = await Service.findById(rec.serviceId).select('name image shortDescription isActive');
    if (!service?.isActive) continue;
    addItem({
      id: rec.id,
      serviceId: rec.serviceId,
      serviceName: rec.serviceName ?? service.name,
      subtitle: rec.reason,
      reason: rec.reason,
      whyAmISeeingThis: rec.whyAmISeeingThis,
      source: rec.source ?? 'recommendation',
      imageUrl: service.image,
      badge: 'FOR YOU',
    });
  }

  const completedBookings = await Booking.find({
    customerId,
    status: BookingStatus.COMPLETED,
  })
    .sort({ updatedAt: -1 })
    .limit(25);

  const serviceStats = new Map<
    string,
    { count: number; lastAt: Date; name: string; serviceId: string }
  >();

  for (const booking of completedBookings) {
    const serviceId = booking.serviceId.toString();
    const existing = serviceStats.get(serviceId);
    if (existing) {
      existing.count += 1;
      if (booking.updatedAt > existing.lastAt) existing.lastAt = booking.updatedAt;
    } else {
      serviceStats.set(serviceId, {
        count: 1,
        lastAt: booking.updatedAt,
        name: booking.serviceSnapshot.name,
        serviceId,
      });
    }
  }

  for (const stats of serviceStats.values()) {
    const service = await Service.findById(stats.serviceId).select('name image isActive');
    if (!service?.isActive) continue;

    const daysSince = Math.floor((Date.now() - stats.lastAt.getTime()) / (24 * 60 * 60 * 1000));
    const timeLabel =
      daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;

    addItem({
      id: `rebook-${stats.serviceId}`,
      serviceId: stats.serviceId,
      serviceName: stats.name,
      subtitle:
        stats.count > 1
          ? `Booked ${stats.count} times · last ${timeLabel}`
          : `Last booked ${timeLabel}`,
      reason: `Book ${stats.name} again`,
      whyAmISeeingThis: 'Based on your past bookings on GhaarFix',
      source: 'booking_history',
      imageUrl: service.image,
      badge: stats.count > 1 ? 'BOOK AGAIN' : 'YOUR HISTORY',
      bookingCount: stats.count,
      lastBookedAt: stats.lastAt.toISOString(),
    });
  }

  const bookedServiceIds = [...serviceStats.keys()];
  if (bookedServiceIds.length > 0) {
    const bookedServices = await Service.find({ _id: { $in: bookedServiceIds } }).select('categoryId');
    const categoryIds = [...new Set(bookedServices.map((s) => s.categoryId?.toString()).filter(Boolean))];

    if (categoryIds.length > 0) {
      const related = await Service.find({
        categoryId: { $in: categoryIds },
        isActive: true,
        _id: { $nin: [...seenServiceIds] },
      })
        .sort({ 'metadata.bookingCount': -1, displayOrder: 1 })
        .limit(6)
        .select('name image shortDescription');

      for (const service of related) {
        addItem({
          id: `related-${service._id.toString()}`,
          serviceId: service._id.toString(),
          serviceName: service.name,
          subtitle: service.shortDescription ?? 'Popular in categories you already use',
          reason: 'Because you book similar home services',
          whyAmISeeingThis: 'Based on categories from your booking history',
          source: 'category',
          imageUrl: service.image,
          badge: 'SIMILAR',
        });
      }
    }
  }

  if (items.length < 4) {
    const trending = await Service.find({ isActive: true, isFeatured: true })
      .sort({ displayOrder: 1, 'metadata.bookingCount': -1 })
      .limit(6)
      .select('name image shortDescription');

    for (const service of trending) {
      addItem({
        id: `trending-${service._id.toString()}`,
        serviceId: service._id.toString(),
        serviceName: service.name,
        subtitle: service.shortDescription ?? 'Trending on GhaarFix',
        reason: 'Popular with homeowners near you',
        whyAmISeeingThis: 'Trending service on GhaarFix',
        source: 'trending',
        imageUrl: service.image,
        badge: 'TRENDING',
      });
    }
  }

  return items.slice(0, 12);
}

export async function personalizeForCustomer(customerId: string) {
  const [carousel, lifecycle, consent, churn] = await Promise.all([
    buildForYouCarousel(customerId),
    getCustomerLifecycle(customerId),
    getOrCreateConsent(customerId),
    CustomerChurnPrediction.findOne({ customerId }),
  ]);

  const topRec = carousel[0] ?? null;
  const channel = consent.marketingOptIn && consent.pushEnabled
    ? MarketingChannel.PUSH
    : MarketingChannel.IN_APP;

  return {
    lifecycle: {
      state: lifecycle?.state,
      reason: lifecycle?.reason,
    },
    carousel,
    recommendation: topRec
      ? {
          serviceId: topRec.serviceId,
          serviceName: topRec.serviceName,
          reason: topRec.reason,
          confidence: 1,
          whyAmISeeingThis: topRec.whyAmISeeingThis,
        }
      : null,
    suggestedChannel: channel,
    suggestedPriority: MessagePriority.SERVICE_REMINDER,
    churnRisk: churn
      ? { level: churn.riskLevel, factors: churn.topFactors, action: churn.recommendedAction }
      : null,
    confidence: topRec ? 1 : 0.5,
  };
}
