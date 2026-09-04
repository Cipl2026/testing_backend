import {
  BookingStatus,
  ProviderServiceApprovalStatus,
  ProviderStatus,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { ProviderTrustMetrics } from '@/models/ProviderTrustMetrics.js';
import { Service } from '@/models/Service.js';
import { User, type UserStatus } from '@/models/User.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

function mapProviderDisplayStatus(profile: {
  providerStatus: ProviderStatus;
  isVerified: boolean;
}) {
  if (profile.providerStatus === ProviderStatus.SUSPENDED) return 'Suspended';
  if (profile.providerStatus === ProviderStatus.INACTIVE) return 'Inactive';
  if (profile.providerStatus === ProviderStatus.PENDING) return 'Pending';
  return profile.isVerified ? 'Verified' : 'Active';
}

export async function adminListCustomers(query: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const filter: Record<string, unknown> = { role: UserRole.CUSTOMER };
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const userIds = users.map((user) => user._id);
  const bookingStats = userIds.length
    ? await Booking.aggregate([
        {
          $match: {
            customerId: { $in: userIds },
            status: BookingStatus.COMPLETED,
          },
        },
        {
          $group: {
            _id: '$customerId',
            bookings: { $sum: 1 },
            spent: { $sum: '$price.finalAmount' },
          },
        },
      ])
    : [];

  const statsByCustomer = new Map(
    bookingStats.map((row) => [
      row._id.toString(),
      { bookings: row.bookings as number, spent: row.spent as number },
    ]),
  );

  return {
    items: users.map((user) => {
      const stats = statsByCustomer.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.fullName ?? 'Customer',
        phone: user.phone ?? '—',
        email: user.email,
        bookings: stats?.bookings ?? 0,
        spent: Math.round(stats?.spent ?? 0),
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      };
    }),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminListProviders(query: {
  page: number;
  limit: number;
  search?: string;
  status?: ProviderStatus;
}) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.providerStatus = query.status;
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await ProviderProfile.countDocuments(filter);
  const profiles = await ProviderProfile.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const providerIds = profiles.map((profile) => profile.userId);

  const [metrics, jobCounts, providerServices, serviceAreas] = await Promise.all([
    providerIds.length
      ? ProviderTrustMetrics.find({ providerId: { $in: providerIds } }).select(
          'providerId averageRating completedJobs',
        )
      : [],
    providerIds.length
      ? Booking.aggregate([
          {
            $match: {
              providerId: { $in: providerIds },
              status: BookingStatus.COMPLETED,
            },
          },
          { $group: { _id: '$providerId', jobs: { $sum: 1 } } },
        ])
      : [],
    providerIds.length
      ? ProviderService.find({
          providerId: { $in: providerIds },
          approvalStatus: ProviderServiceApprovalStatus.APPROVED,
          isActive: true,
        })
          .sort({ createdAt: 1 })
          .select('providerId serviceId')
      : [],
    providerIds.length
      ? ProviderServiceArea.find({ providerId: { $in: providerIds }, isActive: true })
          .sort({ createdAt: 1 })
          .select('providerId name')
      : [],
  ]);

  const serviceIds = [...new Set(providerServices.map((item) => item.serviceId.toString()))];
  const services = serviceIds.length
    ? await Service.find({ _id: { $in: serviceIds } }).select('name')
    : [];
  const serviceNameById = new Map(services.map((service) => [service._id.toString(), service.name]));

  const metricsByProvider = new Map(
    metrics.map((metric) => [metric.providerId.toString(), metric]),
  );
  const jobsByProvider = new Map(
    jobCounts.map((row) => [row._id.toString(), row.jobs as number]),
  );
  const professionByProvider = new Map<string, string>();
  for (const item of providerServices) {
    const providerId = item.providerId.toString();
    if (professionByProvider.has(providerId)) continue;
    professionByProvider.set(
      providerId,
      serviceNameById.get(item.serviceId.toString()) ?? 'Service professional',
    );
  }
  const areaByProvider = new Map<string, string>();
  for (const area of serviceAreas) {
    const providerId = area.providerId.toString();
    if (!areaByProvider.has(providerId)) areaByProvider.set(providerId, area.name);
  }

  return {
    items: profiles.map((profile) => {
      const providerId = profile.userId.toString();
      const metric = metricsByProvider.get(providerId);
      return {
        id: providerId,
        name: profile.fullName ?? 'Provider',
        profession: professionByProvider.get(providerId) ?? '—',
        rating: metric?.averageRating ?? 0,
        jobs: jobsByProvider.get(providerId) ?? metric?.completedJobs ?? 0,
        area: areaByProvider.get(providerId) ?? '—',
        status: mapProviderDisplayStatus(profile),
        providerStatus: profile.providerStatus,
        isVerified: profile.isVerified,
        createdAt: profile.createdAt.toISOString(),
      };
    }),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

async function getCustomerBookingStats(customerId: string) {
  const [stats] = await Booking.aggregate([
    {
      $match: {
        customerId,
        status: BookingStatus.COMPLETED,
      },
    },
    {
      $group: {
        _id: '$customerId',
        bookings: { $sum: 1 },
        spent: { $sum: '$price.finalAmount' },
      },
    },
  ]);

  return {
    bookings: (stats?.bookings as number | undefined) ?? 0,
    spent: Math.round((stats?.spent as number | undefined) ?? 0),
  };
}

export async function adminGetCustomer(userId: string) {
  const user = await User.findOne({ _id: userId, role: UserRole.CUSTOMER });
  if (!user) throw new AppError('Customer not found.', 404, ErrorCode.NOT_FOUND);

  const stats = await getCustomerBookingStats(user._id.toString());
  const recentBookings = await Booking.find({ customerId: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('bookingNumber status scheduledStart price.finalAmount createdAt');

  return {
    id: user._id.toString(),
    name: user.fullName ?? 'Customer',
    phone: user.phone ?? '—',
    email: user.email,
    status: user.status,
    isPhoneVerified: user.isPhoneVerified,
    isProfileComplete: user.isProfileComplete,
    profileImage: user.profileImage,
    bookings: stats.bookings,
    spent: stats.spent,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    recentBookings: recentBookings.map((booking) => ({
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      scheduledStart: booking.scheduledStart?.toISOString(),
      amount: booking.price?.finalAmount ?? 0,
      createdAt: booking.createdAt.toISOString(),
    })),
  };
}

export async function adminUpdateCustomerStatus(
  adminId: string,
  userId: string,
  status: UserStatus,
  reason: string,
) {
  const user = await User.findOne({ _id: userId, role: UserRole.CUSTOMER });
  if (!user) throw new AppError('Customer not found.', 404, ErrorCode.NOT_FOUND);

  const before = user.status;
  user.status = status;
  await user.save();

  await AdminAuditLog.create({
    adminId,
    action: 'CUSTOMER_STATUS_UPDATE',
    entityType: 'User',
    entityId: user._id,
    reason,
    before: { status: before },
    after: { status },
  });

  return adminGetCustomer(userId);
}

export async function adminGetProvider(providerId: string) {
  const profile = await ProviderProfile.findOne({ userId: providerId });
  if (!profile) throw new AppError('Provider not found.', 404, ErrorCode.NOT_FOUND);

  const user = await User.findById(providerId).select('phone status createdAt');
  const [metric, jobCount, providerServices, serviceAreas] = await Promise.all([
    ProviderTrustMetrics.findOne({ providerId }).select('averageRating completedJobs'),
    Booking.countDocuments({ providerId, status: BookingStatus.COMPLETED }),
    ProviderService.find({ providerId, isActive: true })
      .sort({ createdAt: 1 })
      .select('serviceId approvalStatus'),
    ProviderServiceArea.find({ providerId, isActive: true })
      .sort({ createdAt: 1 })
      .select('name'),
  ]);

  const serviceIds = [...new Set(providerServices.map((item) => item.serviceId.toString()))];
  const services = serviceIds.length
    ? await Service.find({ _id: { $in: serviceIds } }).select('name')
    : [];
  const serviceNameById = new Map(services.map((service) => [service._id.toString(), service.name]));

  const recentBookings = await Booking.find({ providerId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('bookingNumber status scheduledStart price.finalAmount createdAt');

  return {
    id: providerId,
    name: profile.fullName ?? 'Provider',
    phone: user?.phone ?? '—',
    email: profile.email,
    status: mapProviderDisplayStatus(profile),
    providerStatus: profile.providerStatus,
    isVerified: profile.isVerified,
    isProfileComplete: profile.isProfileComplete,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    bio: profile.bio,
    rating: metric?.averageRating ?? 0,
    jobs: jobCount || metric?.completedJobs || 0,
    services: providerServices.map((item) => ({
      id: item._id.toString(),
      name: serviceNameById.get(item.serviceId.toString()) ?? 'Service',
      approvalStatus: item.approvalStatus,
    })),
    serviceAreas: serviceAreas.map((area) => ({
      id: area._id.toString(),
      name: area.name,
    })),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    recentBookings: recentBookings.map((booking) => ({
      id: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      scheduledStart: booking.scheduledStart?.toISOString(),
      amount: booking.price?.finalAmount ?? 0,
      createdAt: booking.createdAt.toISOString(),
    })),
  };
}

export async function adminUpdateProviderStatus(
  adminId: string,
  providerId: string,
  status: ProviderStatus,
  reason: string,
) {
  const profile = await ProviderProfile.findOne({ userId: providerId });
  if (!profile) throw new AppError('Provider not found.', 404, ErrorCode.NOT_FOUND);

  const before = profile.providerStatus;
  profile.providerStatus = status;
  await profile.save();

  await AdminAuditLog.create({
    adminId,
    action: 'PROVIDER_STATUS_UPDATE',
    entityType: 'ProviderProfile',
    entityId: profile._id,
    reason,
    before: { providerStatus: before },
    after: { providerStatus: status },
  });

  return adminGetProvider(providerId);
}
