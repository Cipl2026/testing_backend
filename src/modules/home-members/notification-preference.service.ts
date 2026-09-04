import { HomeNotificationEventType, HomeCapability } from '@ghaarfix/shared-types';
import { HomeNotificationPreference } from '@/models/HomeNotificationPreference.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';

const DEFAULT_EVENTS = Object.values(HomeNotificationEventType);

export async function listNotificationPreferences(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_VIEW);
  const prefs = await HomeNotificationPreference.find({ homeId, customerId });
  const map = new Map(prefs.map((p) => [p.eventType, p.enabled]));
  return DEFAULT_EVENTS.map((eventType) => ({
    eventType,
    enabled: map.get(eventType) ?? true,
  }));
}

export async function updateNotificationPreferences(
  customerId: string,
  homeId: string,
  preferences: Array<{ eventType: HomeNotificationEventType; enabled: boolean }>,
) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_VIEW);
  for (const pref of preferences) {
    await HomeNotificationPreference.findOneAndUpdate(
      { homeId, customerId, eventType: pref.eventType },
      { $set: { enabled: pref.enabled } },
      { upsert: true, new: true },
    );
  }
  return listNotificationPreferences(customerId, homeId);
}
