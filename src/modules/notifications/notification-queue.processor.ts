import { QueueName } from '@ghaarfix/shared-types';
import { enqueueJob } from '@/infra/queue.service.js';
import {
  getPushNotificationService,
  type PushMessage,
  type PushTier,
} from '@/modules/push/push-notification.service.js';
import { logger } from '@/utils/logger.js';

export type NotificationQueuePayload = {
  audience: 'provider' | 'customer' | 'user' | 'providers';
  targetId?: string;
  targetIds?: string[];
  message: PushMessage;
};

export async function enqueuePushNotification(payload: NotificationQueuePayload): Promise<void> {
  const jobId = await enqueueJob(QueueName.NOTIFICATIONS, 'push-send', payload as unknown as Record<string, unknown>);
  if (jobId) return;

  await processNotificationJob(payload as unknown as Record<string, unknown>);
}

export async function processNotificationJob(data: Record<string, unknown>): Promise<void> {
  const audience = data.audience as NotificationQueuePayload['audience'];
  const message = data.message as PushMessage;
  const push = getPushNotificationService();

  if (!message?.title || !message?.body) {
    logger.warn('Notification queue job missing message payload');
    return;
  }

  const normalizedMessage: PushMessage = {
    ...message,
    tier: (message.tier ?? 'default') as PushTier,
  };

  switch (audience) {
    case 'provider':
      if (typeof data.targetId === 'string') {
        await push.sendToProvider(data.targetId, normalizedMessage);
      }
      break;
    case 'providers':
      if (Array.isArray(data.targetIds)) {
        await push.sendToProviders(data.targetIds.filter((id): id is string => typeof id === 'string'), normalizedMessage);
      }
      break;
    case 'customer':
      if (typeof data.targetId === 'string') {
        await push.sendToCustomer(data.targetId, normalizedMessage);
      }
      break;
    case 'user':
      if (typeof data.targetId === 'string') {
        await push.sendToUser(data.targetId, normalizedMessage);
      }
      break;
    default:
      logger.warn('Unknown notification queue audience', { audience });
  }
}
