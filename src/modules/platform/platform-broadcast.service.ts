import mongoose from 'mongoose';
import { ErrorCode, UserRole } from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { PushToken } from '@/models/PushToken.js';
import { User } from '@/models/User.js';
import {
  createNotification,
} from '@/modules/notifications/notification.service.js';
import { getPushNotificationService } from '@/modules/push/push-notification.service.js';
import { AppError } from '@/utils/AppError.js';
import type {
  SendPlatformNotificationBody,
  SendTestPlatformNotificationBody,
} from '@/validators/platform-broadcast.js';

export async function sendPlatformBroadcast(
  adminId: string,
  input: SendPlatformNotificationBody,
) {
  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (input.audience === 'ALL_CUSTOMERS') {
    filter.role = UserRole.CUSTOMER;
  } else if (input.audience === 'ALL_PROVIDERS') {
    filter.role = UserRole.PROVIDER;
  }

  const users = await User.find(filter).select('_id role').limit(10_000);
  const push = getPushNotificationService();
  const broadcastId = new mongoose.Types.ObjectId().toString();
  let sent = 0;

  for (const user of users) {
    const userId = user._id.toString();
    await createNotification({
      userId,
      type: 'ADMIN_BROADCAST',
      title: input.title,
      body: input.body,
      data: {
        broadcastId,
        deepLink: input.deepLink,
        audience: input.audience,
      },
    });

    void push.sendToUser(userId, {
      title: input.title,
      body: input.body,
      data: {
        type: 'ADMIN_BROADCAST',
        broadcastId,
        deepLink: input.deepLink ?? '',
      },
      collapseId: `broadcast-${broadcastId}`,
      tier: 'default',
    });
    sent += 1;
  }

  await AdminAuditLog.create({
    adminId,
    action: 'PLATFORM_NOTIFICATION_SENT',
    entityType: 'Broadcast',
    entityId: new mongoose.Types.ObjectId(broadcastId),
    reason: `${input.audience}: ${input.title}`,
    after: {
      sent,
      audience: input.audience,
      title: input.title,
      body: input.body,
      deepLink: input.deepLink,
    },
  });

  return { sent, audience: input.audience, broadcastId };
}

export async function sendTestPlatformPush(
  adminId: string,
  input: SendTestPlatformNotificationBody,
) {
  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (input.userId) {
    filter._id = input.userId;
  } else if (input.phone) {
    filter.phone = input.phone.replace(/\s+/g, '');
  }
  if (input.role === 'CUSTOMER') {
    filter.role = UserRole.CUSTOMER;
  } else if (input.role === 'PROVIDER') {
    filter.role = UserRole.PROVIDER;
  }

  const user = await User.findOne(filter).select('_id fullName phone role');
  if (!user) {
    throw new AppError(
      'No active user found for that phone or ID. Check the number and app role.',
      404,
      ErrorCode.NOT_FOUND,
    );
  }

  const userId = user._id.toString();
  const pushTokens = await PushToken.find({
    $or: [{ customerId: user._id }, { providerId: user._id }],
    isActive: true,
  }).select('token platform');

  if (!pushTokens.length) {
    throw new AppError(
      'This user has no registered push token. Open the mobile app on a real device build, log in, and allow notifications.',
      422,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const title = input.title?.trim() || 'Ghaarfix test notification';
  const body =
    input.body?.trim() ||
    'If you see this on your lock screen, push delivery is working correctly.';
  const tier = input.tier ?? 'default';
  const testId = new mongoose.Types.ObjectId().toString();

  await createNotification({
    userId,
    type: 'ADMIN_TEST_PUSH',
    title,
    body,
    data: {
      testId,
      deepLink: input.deepLink,
      tier,
    },
  });

  const push = getPushNotificationService();
  await push.sendToUser(userId, {
    title,
    body,
    data: {
      type: 'ADMIN_TEST_PUSH',
      testId,
      deepLink: input.deepLink ?? '',
      tier,
    },
    collapseId: `test-${testId}`,
    tier,
  });

  await AdminAuditLog.create({
    adminId,
    action: 'PLATFORM_NOTIFICATION_TEST',
    entityType: 'User',
    entityId: user._id,
    reason: `Test push to ${user.phone ?? userId}`,
    after: {
      userId,
      phone: user.phone,
      role: user.role,
      pushTokens: pushTokens.length,
      tier,
      title,
    },
  });

  return {
    userId,
    name: user.fullName ?? 'User',
    phone: user.phone ?? '—',
    role: user.role,
    pushTokensFound: pushTokens.length,
    platforms: [...new Set(pushTokens.map((token) => token.platform))],
    tier,
    title,
    message:
      tier === 'emergency'
        ? 'Emergency test push sent. Check lock screen and notification shade.'
        : 'Test push sent. Check lock screen and notification shade.',
  };
}
