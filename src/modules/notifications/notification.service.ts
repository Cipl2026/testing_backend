import { Notification } from '@/models/Notification.js';
import { getPushNotificationService } from '@/modules/push/push-notification.service.js';
import { emitNotificationNew } from '@/modules/realtime/socket.service.js';

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const doc = await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    isRead: false,
  });

  emitNotificationNew(input.userId, {
    id: doc._id.toString(),
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    createdAt: doc.createdAt.toISOString(),
  });

  return doc;
}

export async function notifyBookingEvent(
  userId: string,
  type: string,
  title: string,
  body: string,
  bookingId: string,
) {
  await createNotification({ userId, type, title, body, data: { bookingId } });
  void getPushNotificationService().sendToUser(userId, {
    title,
    body,
    data: { bookingId, type },
    collapseId: `booking-${bookingId}`,
    tier: 'default',
  });
}

function serializeNotification(doc: {
  _id: { toString(): string };
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    data: doc.data,
    isRead: doc.isRead,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listNotifications(userId: string, page = 1, limit = 30) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments({ userId }),
  ]);
  const unreadCount = await Notification.countDocuments({ userId, isRead: false });
  return {
    items: items.map(serializeNotification),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    unreadCount,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true },
  );
  if (!doc) return null;
  return serializeNotification(doc);
}

export async function markAllNotificationsRead(userId: string) {
  const result = await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  return { updated: result.modifiedCount };
}

export async function markNotificationsReadBatch(userId: string, ids: string[]) {
  if (!ids.length) return { updated: 0 };
  const result = await Notification.updateMany(
    { userId, _id: { $in: ids } },
    { $set: { isRead: true } },
  );
  return { updated: result.modifiedCount };
}

export async function clearNotifications(userId: string, ids?: string[]) {
  if (ids && ids.length > 0) {
    const result = await Notification.deleteMany({ userId, _id: { $in: ids } });
    return { deleted: result.deletedCount ?? 0 };
  }
  const result = await Notification.deleteMany({ userId });
  return { deleted: result.deletedCount ?? 0 };
}
