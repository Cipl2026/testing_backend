import { MarketingChannel, MessagePriority } from '@ghaarfix/shared-types';
import { MarketingConsent, CommunicationLog, RecommendationFrequencyPolicy } from '@/models/CustomerLifecycle.js';

export async function getOrCreateConsent(customerId: string) {
  return MarketingConsent.findOneAndUpdate(
    { customerId },
    { customerId },
    { upsert: true, new: true },
  );
}

export async function updateConsent(
  customerId: string,
  input: Partial<{
    marketingOptIn: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timezone: string;
  }>,
) {
  return MarketingConsent.findOneAndUpdate(
    { customerId },
    { ...input, customerId },
    { upsert: true, new: true },
  );
}

export async function canSendMessage(input: {
  customerId: string;
  channel: MarketingChannel;
  priority: MessagePriority;
  campaignId?: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  if (input.priority === MessagePriority.CRITICAL || input.priority === MessagePriority.TRANSACTIONAL) {
    return { allowed: true };
  }

  const consent = await getOrCreateConsent(input.customerId);

  if (input.priority === MessagePriority.MARKETING && !consent.marketingOptIn) {
    return { allowed: false, reason: 'Marketing opt-out' };
  }

  if (input.channel === MarketingChannel.PUSH && !consent.pushEnabled) {
    return { allowed: false, reason: 'Push disabled' };
  }
  if (input.channel === MarketingChannel.EMAIL && !consent.emailEnabled) {
    return { allowed: false, reason: 'Email disabled' };
  }
  if (input.channel === MarketingChannel.SMS && !consent.smsEnabled) {
    return { allowed: false, reason: 'SMS disabled' };
  }
  if (input.channel === MarketingChannel.IN_APP && !consent.inAppEnabled) {
    return { allowed: false, reason: 'In-app disabled' };
  }

  if (consent.quietHoursStart && consent.quietHoursEnd && input.priority === MessagePriority.MARKETING) {
    const now = new Date();
    const hour = now.getHours();
    const start = parseInt(consent.quietHoursStart.split(':')[0] ?? '22', 10);
    const end = parseInt(consent.quietHoursEnd.split(':')[0] ?? '8', 10);
    if (start > end ? hour >= start || hour < end : hour >= start && hour < end) {
      return { allowed: false, reason: 'Quiet hours' };
    }
  }

  const policy = await RecommendationFrequencyPolicy.findOne({ key: 'global' });
  const maxPerDay = input.priority === MessagePriority.MARKETING
    ? (policy?.maxMarketingPerDay ?? 1)
    : (policy?.maxPerDay ?? 5);
  const maxPerWeek = input.priority === MessagePriority.MARKETING
    ? (policy?.maxMarketingPerWeek ?? 3)
    : (policy?.maxPerWeek ?? 15);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [dayCount, weekCount] = await Promise.all([
    CommunicationLog.countDocuments({
      customerId: input.customerId,
      channel: input.channel,
      priority: input.priority,
      sentAt: { $gte: dayAgo },
    }),
    CommunicationLog.countDocuments({
      customerId: input.customerId,
      channel: input.channel,
      sentAt: { $gte: weekAgo },
    }),
  ]);

  if (dayCount >= maxPerDay) {
    return { allowed: false, reason: 'Daily frequency limit reached' };
  }
  if (weekCount >= maxPerWeek) {
    return { allowed: false, reason: 'Weekly frequency limit reached' };
  }

  return { allowed: true };
}

export async function logCommunication(input: {
  customerId: string;
  channel: MarketingChannel;
  priority: MessagePriority;
  campaignId?: string;
  messageType: string;
  idempotencyKey: string;
}) {
  try {
    await CommunicationLog.create({
      ...input,
      sentAt: new Date(),
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      return false;
    }
    throw err;
  }
  return true;
}
