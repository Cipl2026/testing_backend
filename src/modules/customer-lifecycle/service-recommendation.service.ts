import {
  BookingStatus,
  ServiceRecommendationSource,
  ServiceRecommendationStatus,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { Service } from '@/models/Service.js';
import { ServiceRecommendation } from '@/models/CustomerLifecycle.js';
import { generateRecommendationsForCustomer } from '@/modules/discovery-growth/recommendation.service.js';

const MAX_ACTIVE = 5;

export async function listServiceRecommendations(customerId: string) {
  const now = new Date();
  const items = await ServiceRecommendation.find({
    customerId,
    status: ServiceRecommendationStatus.ACTIVE,
    expiresAt: { $gt: now },
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(MAX_ACTIVE)
    .populate('serviceId', 'name slug');

  return items.map((r) => {
    const svc = r.serviceId as { _id?: { toString(): string }; name?: string } | { toString(): string };
    const serviceId =
      svc && typeof svc === 'object' && '_id' in svc && svc._id
        ? svc._id.toString()
        : String(r.serviceId);
    const serviceName =
      svc && typeof svc === 'object' && 'name' in svc && typeof svc.name === 'string'
        ? svc.name
        : (r.serviceId as { name?: string })?.name;

    return {
      id: r._id.toString(),
      serviceId,
      serviceName,
    reason: r.reason,
    confidence: r.confidence,
    priority: r.priority,
    source: r.source,
    expiresAt: r.expiresAt,
    whyAmISeeingThis: r.reason,
    };
  });
}

export async function dismissServiceRecommendation(customerId: string, recommendationId: string) {
  return ServiceRecommendation.findOneAndUpdate(
    { _id: recommendationId, customerId, status: ServiceRecommendationStatus.ACTIVE },
    { status: ServiceRecommendationStatus.DISMISSED, dismissedAt: new Date() },
    { new: true },
  );
}

export async function generateServiceRecommendations(customerId: string) {
  await generateRecommendationsForCustomer(customerId);

  const lastBooking = await Booking.findOne({
    customerId,
    status: BookingStatus.COMPLETED,
  })
    .sort({ updatedAt: -1 })
    .populate('serviceId');

  const recentBookings = await Booking.find({
    customerId,
    status: BookingStatus.COMPLETED,
  })
    .sort({ updatedAt: -1 })
    .limit(8);

  const seenRebook = new Set<string>();
  for (const booking of recentBookings) {
    const serviceId = booking.serviceId?.toString();
    if (!serviceId || seenRebook.has(serviceId)) continue;
    seenRebook.add(serviceId);
    const service = await Service.findById(serviceId);
    if (!service?.isActive) continue;

    const daysSince = Math.floor(
      (Date.now() - booking.updatedAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    const timeLabel =
      daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;

    await upsertServiceRecommendation({
      customerId,
      serviceId,
      reason: `You booked ${service.name} ${timeLabel}. Tap to book again.`,
      source: ServiceRecommendationSource.BEHAVIORAL,
      confidence: 0.85,
      priority: 20,
    });
  }

  if (lastBooking?.serviceId) {
    const service = await Service.findById(lastBooking.serviceId);
    if (service) {
      const monthsSince = lastBooking.updatedAt
        ? Math.floor((Date.now() - lastBooking.updatedAt.getTime()) / (30 * 24 * 60 * 60 * 1000))
        : 0;

      if (monthsSince >= 6) {
        await upsertServiceRecommendation({
          customerId,
          serviceId: service._id.toString(),
          reason: `Your ${service.name} was last serviced ${monthsSince} months ago. A maintenance service may be useful.`,
          source: ServiceRecommendationSource.BEHAVIORAL,
          confidence: 0.75,
          priority: 10,
        });
      }
    }
  }

  const activeCount = await ServiceRecommendation.countDocuments({
    customerId,
    status: ServiceRecommendationStatus.ACTIVE,
    expiresAt: { $gt: new Date() },
  });

  return activeCount;
}

async function upsertServiceRecommendation(input: {
  customerId: string;
  serviceId: string;
  reason: string;
  source: ServiceRecommendationSource;
  confidence: number;
  priority: number;
}) {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const recent = await ServiceRecommendation.findOne({
    customerId: input.customerId,
    serviceId: input.serviceId,
    status: ServiceRecommendationStatus.ACTIVE,
    expiresAt: { $gt: new Date() },
  });
  if (recent) return recent;

  const activeCount = await ServiceRecommendation.countDocuments({
    customerId: input.customerId,
    status: ServiceRecommendationStatus.ACTIVE,
    expiresAt: { $gt: new Date() },
  });
  if (activeCount >= MAX_ACTIVE) return null;

  return ServiceRecommendation.create({
    ...input,
    status: ServiceRecommendationStatus.ACTIVE,
    expiresAt,
    metadata: { basedOnServiceHistory: true },
  });
}
