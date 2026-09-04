import { SupportTicketCategory, UserRole } from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { Notification } from '@/models/Notification.js';
import { SupportTicket } from '@/models/SupportTicket.js';
import { User } from '@/models/User.js';
import { buildPaginationMeta } from '@/utils/catalog.js';

const DISPUTE_CATEGORIES = [
  SupportTicketCategory.QUALITY_ISSUE,
  SupportTicketCategory.PAYMENT_ISSUE,
  SupportTicketCategory.SERVICE_NOT_COMPLETED,
  SupportTicketCategory.SAFETY_CONCERN,
];

export async function adminListAuditLogs(query: {
  page: number;
  limit: number;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.search) {
    filter.$or = [
      { action: { $regex: query.search, $options: 'i' } },
      { entityType: { $regex: query.search, $options: 'i' } },
      { reason: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await AdminAuditLog.countDocuments(filter);
  const items = await AdminAuditLog.find(filter)
    .sort({ timestamp: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const adminIds = [...new Set(items.map((item) => item.adminId.toString()))];
  const admins = await User.find({ _id: { $in: adminIds } }).select('fullName email');
  const adminNameById = new Map(
    admins.map((admin) => [admin._id.toString(), admin.fullName ?? admin.email ?? 'Admin']),
  );

  return {
    items: items.map((item) => ({
      id: item._id.toString(),
      actor: adminNameById.get(item.adminId.toString()) ?? 'Admin',
      action: item.action,
      target: `${item.entityType} · ${item.entityId.toString().slice(-6)}`,
      reason: item.reason,
      time: item.timestamp.toISOString(),
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminListPlatformNotifications(query: {
  page: number;
  limit: number;
  search?: string;
}) {
  const filter: Record<string, unknown> = {};
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { body: { $regex: query.search, $options: 'i' } },
      { type: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await Notification.countDocuments(filter);
  const items = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  const userIds = [...new Set(items.map((item) => item.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select('role fullName phone');
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  return {
    items: items.map((item) => {
      const user = userById.get(item.userId.toString());
      return {
        id: item._id.toString(),
        title: item.title,
        audience: user?.role === UserRole.PROVIDER ? 'Provider' : 'Customer',
        recipient: user?.fullName ?? user?.phone ?? 'User',
        type: item.type,
        sent: item.createdAt.toISOString(),
        status: item.isRead ? 'Read' : 'Delivered',
      };
    }),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminListDisputes(query: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const filter: Record<string, unknown> = {
    category: { $in: DISPUTE_CATEGORIES },
  };
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { ticketNumber: { $regex: query.search, $options: 'i' } },
      { subject: { $regex: query.search, $options: 'i' } },
    ];
  }

  const total = await SupportTicket.countDocuments(filter);
  const items = await SupportTicket.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);

  return {
    items: items.map((ticket) => ({
      id: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      booking: ticket.bookingId?.toString().slice(-6) ?? '—',
      openedBy: ticket.customerId.toString().slice(-6),
      reason: ticket.category.replace(/_/g, ' '),
      subject: ticket.subject,
      status: ticket.status,
      date: ticket.createdAt.toISOString(),
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}
