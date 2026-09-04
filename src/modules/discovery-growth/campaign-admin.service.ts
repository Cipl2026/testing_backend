import { CampaignStatus } from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { GrowthCampaign } from '@/models/GrowthCampaign.js';
import { SeasonalCampaignRule } from '@/models/SeasonalCampaignRule.js';
import { SearchSynonym } from '@/models/SearchSynonym.js';
import { Home } from '@/models/Home.js';
import { Booking } from '@/models/Booking.js';
import { BookingStatus } from '@ghaarfix/shared-types';

export async function listSearchSynonyms() {
  return SearchSynonym.find().sort({ term: 1 });
}

export async function createSearchSynonym(
  adminId: string,
  data: { term: string; synonyms: string[]; isActive?: boolean },
) {
  const synonym = await SearchSynonym.create(data);
  await AdminAuditLog.create({
    adminId,
    action: 'SEARCH_SYNONYM_CREATED',
    entityType: 'SearchSynonym',
    entityId: synonym._id,
    after: synonym.toObject() as unknown as Record<string, unknown>,
    reason: 'Admin created search synonym',
  });
  return synonym;
}

export async function updateSearchSynonym(
  adminId: string,
  id: string,
  data: Partial<{ term: string; synonyms: string[]; isActive: boolean }>,
) {
  const before = await SearchSynonym.findById(id);
  const synonym = await SearchSynonym.findByIdAndUpdate(id, data, { new: true });
  if (synonym) {
    await AdminAuditLog.create({
      adminId,
      action: 'SEARCH_SYNONYM_UPDATED',
      entityType: 'SearchSynonym',
      entityId: synonym._id,
      before: before?.toObject() as unknown as Record<string, unknown>,
      after: synonym.toObject() as unknown as Record<string, unknown>,
      reason: 'Admin updated search synonym',
    });
  }
  return synonym;
}

export async function deleteSearchSynonym(adminId: string, id: string) {
  const before = await SearchSynonym.findById(id);
  const synonym = await SearchSynonym.findByIdAndDelete(id);
  if (before) {
    await AdminAuditLog.create({
      adminId,
      action: 'SEARCH_SYNONYM_DELETED',
      entityType: 'SearchSynonym',
      entityId: before._id,
      before: before.toObject() as unknown as Record<string, unknown>,
      reason: 'Admin deleted search synonym',
    });
  }
  return synonym;
}

export async function listSeasonalRules() {
  return SeasonalCampaignRule.find().sort({ priority: -1 });
}

export async function createSeasonalRule(
  adminId: string,
  data: Partial<InstanceType<typeof SeasonalCampaignRule>>,
) {
  const rule = await SeasonalCampaignRule.create(data);
  await AdminAuditLog.create({
    adminId,
    action: 'SEASONAL_RULE_CREATED',
    entityType: 'SeasonalCampaignRule',
    entityId: rule._id,
    after: rule.toObject() as unknown as Record<string, unknown>,
    reason: 'Admin created seasonal campaign rule',
  });
  return rule;
}

export async function updateSeasonalRule(
  adminId: string,
  id: string,
  data: Partial<InstanceType<typeof SeasonalCampaignRule>>,
) {
  const rule = await SeasonalCampaignRule.findByIdAndUpdate(id, data, { new: true });
  if (rule) {
    await AdminAuditLog.create({
      adminId,
      action: 'SEASONAL_RULE_UPDATED',
      entityType: 'SeasonalCampaignRule',
      entityId: rule._id,
      after: rule.toObject() as unknown as Record<string, unknown>,
      reason: 'Admin updated seasonal campaign rule',
    });
  }
  return rule;
}

export async function deleteSeasonalRule(adminId: string, id: string) {
  const before = await SeasonalCampaignRule.findById(id);
  const rule = await SeasonalCampaignRule.findByIdAndDelete(id);
  if (before) {
    await AdminAuditLog.create({
      adminId,
      action: 'SEASONAL_RULE_DELETED',
      entityType: 'SeasonalCampaignRule',
      entityId: before._id,
      reason: 'Admin deleted seasonal campaign rule',
    });
  }
  return rule;
}

export async function listCampaigns() {
  return GrowthCampaign.find().sort({ createdAt: -1 });
}

export async function createCampaign(
  adminId: string,
  data: Partial<InstanceType<typeof GrowthCampaign>>,
) {
  const campaign = await GrowthCampaign.create(data);
  await AdminAuditLog.create({
    adminId,
    action: 'GROWTH_CAMPAIGN_CREATED',
    entityType: 'GrowthCampaign',
    entityId: campaign._id,
    after: campaign.toObject() as unknown as Record<string, unknown>,
    reason: 'Admin created growth campaign',
  });
  return campaign;
}

export async function updateCampaign(
  adminId: string,
  id: string,
  data: Partial<InstanceType<typeof GrowthCampaign>>,
) {
  const campaign = await GrowthCampaign.findByIdAndUpdate(id, data, { new: true });
  if (campaign) {
    await AdminAuditLog.create({
      adminId,
      action: 'GROWTH_CAMPAIGN_UPDATED',
      entityType: 'GrowthCampaign',
      entityId: campaign._id,
      after: campaign.toObject() as unknown as Record<string, unknown>,
      reason: 'Admin updated growth campaign',
    });
  }
  return campaign;
}

export async function deleteCampaign(adminId: string, id: string) {
  const before = await GrowthCampaign.findById(id);
  const campaign = await GrowthCampaign.findByIdAndDelete(id);
  if (before) {
    await AdminAuditLog.create({
      adminId,
      action: 'GROWTH_CAMPAIGN_DELETED',
      entityType: 'GrowthCampaign',
      entityId: before._id,
      reason: 'Admin deleted growth campaign',
    });
  }
  return campaign;
}

export async function previewCampaignAudience(campaignId: string) {
  const campaign = await GrowthCampaign.findById(campaignId);
  if (!campaign) return { count: 0, segment: null };

  const regionFilter =
    campaign.regions.length > 0
      ? { 'metadata.state': { $in: campaign.regions } }
      : {};

  let customerIds: string[] = [];

  switch (campaign.audienceSegment) {
    case 'INACTIVE_CUSTOMERS': {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const active = await Booking.distinct('customerId', {
        updatedAt: { $gte: since },
        status: BookingStatus.COMPLETED,
      });
      const homes = await Home.find(regionFilter).select('customerId');
      customerIds = homes
        .map((h) => h.customerId.toString())
        .filter((id) => !active.map(String).includes(id));
      break;
    }
    case 'RECENT_CUSTOMERS': {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      customerIds = (
        await Booking.distinct('customerId', {
          createdAt: { $gte: since },
          status: BookingStatus.COMPLETED,
        })
      ).map(String);
      break;
    }
    default:
      customerIds = (await Home.find(regionFilter).distinct('customerId')).map(String);
  }

  return { count: customerIds.length, segment: campaign.audienceSegment };
}

export async function runScheduledCampaigns() {
  const now = new Date();
  const campaigns = await GrowthCampaign.find({
    status: { $in: [CampaignStatus.SCHEDULED, CampaignStatus.RUNNING] },
    startAt: { $lte: now },
    endAt: { $gte: now },
  });

  let processed = 0;
  for (const campaign of campaigns) {
    const dedupeKey = `campaign-send-${campaign._id}-${now.toISOString().slice(0, 10)}`;
    if (campaign.dedupeKey === dedupeKey) continue;

    const updated = await GrowthCampaign.findOneAndUpdate(
      { _id: campaign._id, dedupeKey: { $ne: dedupeKey } },
      {
        $set: { dedupeKey, lastSentAt: now, status: CampaignStatus.RUNNING },
        $inc: { sentCount: 1 },
      },
      { new: true },
    );

    if (updated) processed += 1;
  }

  const completed = await GrowthCampaign.updateMany(
    { endAt: { $lt: now }, status: { $ne: CampaignStatus.COMPLETED } },
    { status: CampaignStatus.COMPLETED },
  );

  return { processed, completed: completed.modifiedCount };
}
