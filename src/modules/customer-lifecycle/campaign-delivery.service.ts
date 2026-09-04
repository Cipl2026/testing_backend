import {
  LifecycleCampaignStatus,
  MarketingChannel,
  MessagePriority,
} from '@ghaarfix/shared-types';
import { LifecycleCampaign } from '@/models/CustomerLifecycle.js';
import { CustomerLifecycleSnapshot } from '@/models/CustomerLifecycle.js';
import { canSendMessage, logCommunication } from '@/modules/customer-lifecycle/consent.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { recordTouchpoint } from '@/modules/customer-lifecycle/attribution.service.js';

export async function listCampaigns(query: { status?: LifecycleCampaignStatus; page?: number; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    LifecycleCampaign.find(filter).sort({ startAt: -1 }).skip(skip).limit(limit),
    LifecycleCampaign.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function createCampaign(data: Partial<InstanceType<typeof LifecycleCampaign>>) {
  return LifecycleCampaign.create(data);
}

export async function updateCampaign(id: string, data: Partial<InstanceType<typeof LifecycleCampaign>>) {
  return LifecycleCampaign.findByIdAndUpdate(id, data, { new: true });
}

export async function previewCampaignAudience(campaignId: string) {
  const campaign = await LifecycleCampaign.findById(campaignId);
  if (!campaign) return null;

  const audience = campaign.audience as { lifecycleStates?: string[] };
  const filter: Record<string, unknown> = {};
  if (audience.lifecycleStates?.length) {
    filter.state = { $in: audience.lifecycleStates };
  }

  const eligible = await CustomerLifecycleSnapshot.countDocuments(filter);
  return {
    campaignId,
    estimatedAudience: eligible,
    consentExclusionsNote: 'Customers without marketing consent will be excluded at send time.',
    frequencyExclusionsNote: 'Frequency guard applies per channel.',
  };
}

export async function launchCampaign(campaignId: string) {
  const campaign = await LifecycleCampaign.findById(campaignId);
  if (!campaign) return null;

  campaign.status = LifecycleCampaignStatus.ACTIVE;
  await campaign.save();
  return campaign;
}

export async function pauseCampaign(campaignId: string) {
  return LifecycleCampaign.findByIdAndUpdate(
    campaignId,
    { status: LifecycleCampaignStatus.PAUSED },
    { new: true },
  );
}

export async function deliverScheduledCampaigns(): Promise<number> {
  const now = new Date();
  const campaigns = await LifecycleCampaign.find({
    status: LifecycleCampaignStatus.ACTIVE,
    startAt: { $lte: now },
    endAt: { $gte: now },
  });

  let sent = 0;
  for (const campaign of campaigns) {
    const audience = campaign.audience as { lifecycleStates?: string[] };
    const filter: Record<string, unknown> = {};
    if (audience.lifecycleStates?.length) {
      filter.state = { $in: audience.lifecycleStates };
    }

    const recipients = await CustomerLifecycleSnapshot.find(filter).limit(50);
    const content = campaign.content as { title?: string; body?: string };
    const channel = campaign.channels[0] ?? MarketingChannel.IN_APP;

    for (const recipient of recipients) {
      const customerId = recipient.customerId.toString();
      const idempotencyKey = `campaign:${campaign._id}:${customerId}`;

      const check = await canSendMessage({
        customerId,
        channel,
        priority: MessagePriority.MARKETING,
        campaignId: campaign._id.toString(),
      });
      if (!check.allowed) continue;

      const logged = await logCommunication({
        customerId,
        channel,
        priority: MessagePriority.MARKETING,
        campaignId: campaign._id.toString(),
        messageType: 'CAMPAIGN',
        idempotencyKey,
      });
      if (!logged) continue;

      if (channel === MarketingChannel.IN_APP || channel === MarketingChannel.PUSH) {
        await createNotification({
          userId: customerId,
          type: 'CAMPAIGN',
          title: content.title ?? campaign.name,
          body: content.body ?? campaign.name,
          data: { campaignId: campaign._id.toString() },
        });
      }

      await recordTouchpoint({
        customerId,
        campaignId: campaign._id.toString(),
        channel,
        eventType: 'CAMPAIGN_SENT',
      });

      sent += 1;
    }

    campaign.sentCount += sent;
    campaign.status = LifecycleCampaignStatus.COMPLETED;
    await campaign.save();
  }

  return sent;
}
