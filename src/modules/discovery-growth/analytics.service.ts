import {
  AnalyticsEventName,
  BLOCKED_ANALYTICS_PROPERTIES,
} from '@ghaarfix/shared-types';
import { AnalyticsEvent } from '@/models/AnalyticsEvent.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';

function validateProperties(properties: Record<string, unknown>): void {
  for (const key of Object.keys(properties)) {
    if ((BLOCKED_ANALYTICS_PROPERTIES as readonly string[]).includes(key)) {
      throw new AppError(
        `Property "${key}" is not allowed in analytics events.`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }
}

export async function trackEvent(input: {
  eventName: AnalyticsEventName;
  customerId?: string;
  providerId?: string;
  bookingId?: string;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  const properties = input.properties ?? {};
  validateProperties(properties);

  return AnalyticsEvent.create({
    eventName: input.eventName,
    customerId: input.customerId,
    providerId: input.providerId,
    bookingId: input.bookingId,
    properties,
    occurredAt: input.occurredAt ?? new Date(),
  });
}

export async function getGrowthAnalytics() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const funnel = await AnalyticsEvent.aggregate([
    { $match: { occurredAt: { $gte: since30d } } },
    { $group: { _id: '$eventName', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const recommendationEvents = await AnalyticsEvent.aggregate([
    {
      $match: {
        occurredAt: { $gte: since30d },
        eventName: {
          $in: [
            AnalyticsEventName.RECOMMENDATION_VIEWED,
            AnalyticsEventName.RECOMMENDATION_CLICKED,
            AnalyticsEventName.RECOMMENDATION_DISMISSED,
          ],
        },
      },
    },
    { $group: { _id: '$eventName', count: { $sum: 1 } } },
  ]);

  return {
    funnel,
    recommendationEvents,
    periodDays: 30,
  };
}

export async function aggregateGrowthAnalytics() {
  return getGrowthAnalytics();
}
