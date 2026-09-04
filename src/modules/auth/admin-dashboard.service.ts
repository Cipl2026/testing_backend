import {
  BookingStatus,
  ProviderStatus,
  UrgentRequestStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { Service } from '@/models/Service.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { User } from '@/models/User.js';
import { serializeBookingSummary } from '@/utils/bookingSerializers.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function buildLast7DayKeys(): string[] {
  const keys: string[] = [];
  const today = startOfDay(new Date());
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

export async function getDashboardOverview() {
  const todayStart = startOfDay(new Date());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const activeStatuses = [
    BookingStatus.PENDING_PROVIDER,
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_EN_ROUTE,
    BookingStatus.PROVIDER_ARRIVED,
    BookingStatus.IN_PROGRESS,
    BookingStatus.RESCHEDULE_REQUESTED,
  ];

  const [
    customers,
    providers,
    todaysBookings,
    activeBookings,
    cancelledBookings,
    urgentRequests,
    weeklyBookings,
    weeklyUrgent,
    avgJobValueAgg,
    bookingTrendAgg,
    urgentTrendAgg,
    recentBookings,
    recentUrgent,
    topProvidersAgg,
  ] = await Promise.all([
    User.countDocuments({ role: UserRole.CUSTOMER, status: 'ACTIVE' }),
    ProviderProfile.countDocuments({ providerStatus: { $in: [ProviderStatus.PENDING, ProviderStatus.ACTIVE] } }),
    Booking.countDocuments({ createdAt: { $gte: todayStart } }),
    Booking.countDocuments({ status: { $in: activeStatuses } }),
    Booking.countDocuments({ status: BookingStatus.CANCELLED }),
    UrgentRequest.countDocuments({
      status: { $in: [UrgentRequestStatus.SEARCHING, UrgentRequestStatus.ASSIGNED] },
    }),
    Booking.countDocuments({ createdAt: { $gte: weekStart } }),
    UrgentRequest.countDocuments({ createdAt: { $gte: weekStart } }),
    Booking.aggregate([
      { $match: { status: BookingStatus.COMPLETED, createdAt: { $gte: since7d } } },
      { $group: { _id: null, avg: { $avg: '$price.finalAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    UrgentRequest.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Booking.find().sort({ createdAt: -1 }).limit(6),
    UrgentRequest.find().sort({ createdAt: -1 }).limit(6),
    Booking.aggregate([
      { $match: { status: BookingStatus.COMPLETED } },
      { $group: { _id: '$providerId', jobs: { $sum: 1 } } },
      { $sort: { jobs: -1 } },
      { $limit: 4 },
    ]),
  ]);

  const bookingTrendMap = new Map(bookingTrendAgg.map((row) => [row._id as string, row.count as number]));
  const urgentTrendMap = new Map(urgentTrendAgg.map((row) => [row._id as string, row.count as number]));

  const bookingTrend = buildLast7DayKeys().map((key) => {
    const date = new Date(`${key}T00:00:00`);
    return {
      day: DAY_LABELS[date.getDay()],
      date: key,
      bookings: bookingTrendMap.get(key) ?? 0,
      urgent: urgentTrendMap.get(key) ?? 0,
    };
  });

  const providerIds = topProvidersAgg.map((row) => row._id);
  const [profiles, metrics] = await Promise.all([
    ProviderProfile.find({ userId: { $in: providerIds } }).select('userId fullName providerStatus'),
    ProviderTrustMetrics.find({ providerId: { $in: providerIds } }).select('providerId averageRating'),
  ]);

  const profileByUserId = new Map(profiles.map((p) => [p.userId.toString(), p]));
  const ratingByProviderId = new Map(metrics.map((m) => [m.providerId.toString(), m.averageRating]));

  const topProviders = topProvidersAgg.map((row) => {
    const providerId = row._id.toString();
    const profile = profileByUserId.get(providerId);
    return {
      id: providerId,
      name: profile?.fullName ?? 'Provider',
      status: profile?.providerStatus ?? ProviderStatus.PENDING,
      jobs: row.jobs as number,
      rating: ratingByProviderId.get(providerId) ?? 0,
    };
  });

  const avgJobValue = Math.round(avgJobValueAgg[0]?.avg ?? 0);
  const scheduledWeek = bookingTrend.reduce((sum, d) => sum + d.bookings, 0);
  const urgentWeek = bookingTrend.reduce((sum, d) => sum + d.urgent, 0);
  const conversionRate =
    weeklyBookings > 0 ? Math.min(100, Math.round((weeklyBookings / Math.max(weeklyBookings + weeklyUrgent, 1)) * 100)) : 0;

  return {
    totals: {
      customers,
      providers,
      bookings: weeklyBookings,
      todaysBookings,
      activeBookings,
      cancelledBookings,
      urgentRequests,
    },
    analytics: {
      weeklyBookings,
      weeklyUrgent,
      scheduledWeek,
      urgentWeek,
      conversionRate,
      avgJobValue,
    },
    bookingTrend,
    recentBookings: recentBookings.map((booking) => {
      const summary = serializeBookingSummary(booking);
      return {
        id: summary.id,
        bookingNumber: summary.bookingNumber,
        service: summary.service?.name ?? 'Service',
        customer: summary.address?.recipientName ?? 'Customer',
        provider: summary.provider?.fullName ?? '—',
        status: summary.status,
        amount: summary.price?.finalAmount ?? 0,
        scheduledStart: summary.scheduledStart,
      };
    }),
    recentUrgent: await Promise.all(
      recentUrgent.map(async (request) => {
        const service = await Service.findById(request.serviceId).select('name');
        return {
          id: request._id.toString(),
          requestNumber: request.requestNumber,
          service: service?.name ?? 'Service',
          status: request.status,
          createdAt: request.createdAt.toISOString(),
        };
      }),
    ),
    topProviders,
  };
}
