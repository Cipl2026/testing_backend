import { logger } from '@/utils/logger.js';

/** Default marketing/booking alerts — lock screen + notification shade. */
export const PUSH_CHANNEL_ALERTS = 'ghaarfix-alerts';
/** Urgent job dispatch — bypasses DND on Android, max importance. */
export const PUSH_CHANNEL_EMERGENCY = 'ghaarfix-emergency';

export type PushTier = 'default' | 'emergency';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  collapseId?: string;
  subtitle?: string;
  /** default = offers/updates; emergency = urgent jobs (heads-up / DND-bypass channel). */
  tier?: PushTier;
}

export interface PushNotificationService {
  sendToProvider(providerId: string, message: PushMessage): Promise<void>;
  sendToProviders(providerIds: string[], message: PushMessage): Promise<void>;
  sendToCustomer(customerId: string, message: PushMessage): Promise<void>;
  sendToUser(userId: string, message: PushMessage): Promise<void>;
}

/** @deprecated Use PUSH_CHANNEL_ALERTS */
export const PUSH_CHANNEL_ID = PUSH_CHANNEL_ALERTS;

function normalizePushData(data?: Record<string, string>): Record<string, string> | undefined {
  if (!data) return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value);
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function resolvePushDelivery(message: PushMessage) {
  const emergency = message.tier === 'emergency';
  return {
    channelId: emergency ? PUSH_CHANNEL_EMERGENCY : PUSH_CHANNEL_ALERTS,
    priority: 'high' as const,
    sound: 'default' as const,
    ttl: emergency ? 120 : undefined,
    ...(emergency ? { sticky: true } : {}),
  };
}

async function sendExpoPush(tokens: string[], message: PushMessage): Promise<void> {
  if (!tokens.length) return;

  const delivery = resolvePushDelivery(message);
  const payload = tokens.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    subtitle: message.subtitle,
    data: normalizePushData({
      ...message.data,
      tier: message.tier ?? 'default',
      channelId: delivery.channelId,
    }),
    sound: delivery.sound,
    priority: delivery.priority,
    channelId: delivery.channelId,
    ...(delivery.ttl ? { ttl: delivery.ttl } : {}),
    ...(message.collapseId ? { collapseId: message.collapseId } : {}),
  }));

  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = (await response.json()) as {
        data?: Array<{ status: string; message?: string; details?: unknown }>;
      };

      if (!response.ok) {
        logger.warn('Expo push API returned non-OK status', {
          status: response.status,
          result,
        });
        continue;
      }

      const failures = (result.data ?? []).filter((item) => item.status === 'error');
      if (failures.length) {
        logger.warn('Expo push delivery errors', { failures: failures.slice(0, 5) });
      }
    } catch (error) {
      logger.error('Failed to send Expo push notification', { error });
    }
  }
}

class ExpoPushNotificationService implements PushNotificationService {
  async sendToProvider(providerId: string, message: PushMessage): Promise<void> {
    const { PushToken } = await import('@/models/PushToken.js');
    const tokens = await PushToken.find({ providerId, isActive: true }).distinct('token');
    await sendExpoPush(tokens, message);
  }

  async sendToProviders(providerIds: string[], message: PushMessage): Promise<void> {
    const { PushToken } = await import('@/models/PushToken.js');
    const tokens = await PushToken.find({ providerId: { $in: providerIds }, isActive: true }).distinct(
      'token',
    );
    await sendExpoPush(tokens, message);
  }

  async sendToCustomer(customerId: string, message: PushMessage): Promise<void> {
    const { PushToken } = await import('@/models/PushToken.js');
    const tokens = await PushToken.find({ customerId, isActive: true }).distinct('token');
    await sendExpoPush(tokens, message);
  }

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const { PushToken } = await import('@/models/PushToken.js');
    const tokens = await PushToken.find({
      $or: [{ providerId: userId }, { customerId: userId }],
      isActive: true,
    }).distinct('token');
    await sendExpoPush(tokens, message);
  }
}

let pushService: PushNotificationService | null = null;

export function getPushNotificationService(): PushNotificationService {
  if (!pushService) {
    pushService = new ExpoPushNotificationService();
  }
  return pushService;
}
