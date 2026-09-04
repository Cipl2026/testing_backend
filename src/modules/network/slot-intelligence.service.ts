import { SlotIntelligenceStatus, SupplyDemandStatus } from '@ghaarfix/shared-types';
import { analyzeZoneSupplyDemand } from '@/modules/network/supply-demand.service.js';
import { floorToBucket } from '@/modules/network/time-bucket.util.js';
import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from '@/modules/network/time-bucket.util.js';

export interface SlotIntelligence {
  time: string;
  status: SlotIntelligenceStatus;
  message?: string;
}

export function classifySlotStatus(supplyStatus: SupplyDemandStatus): SlotIntelligenceStatus {
  switch (supplyStatus) {
    case SupplyDemandStatus.SURPLUS:
    case SupplyDemandStatus.BALANCED:
      return SlotIntelligenceStatus.AVAILABLE;
    case SupplyDemandStatus.CONSTRAINED:
      return SlotIntelligenceStatus.LIMITED;
    case SupplyDemandStatus.CRITICAL:
      return SlotIntelligenceStatus.AT_RISK;
    default:
      return SlotIntelligenceStatus.AVAILABLE;
  }
}

export async function getSlotIntelligenceForDay(
  zoneId: string,
  serviceId: string,
  date?: string,
): Promise<SlotIntelligence[]> {
  const day = date ?? DateTime.now().setZone(DEFAULT_TIMEZONE).toISODate()!;
  const slots: SlotIntelligence[] = [];

  for (let hour = 8; hour <= 20; hour += 2) {
    const local = DateTime.fromISO(`${day}T${String(hour).padStart(2, '0')}:00`, {
      zone: DEFAULT_TIMEZONE,
    });
    const bucket = floorToBucket(local.toUTC().toJSDate());
    const analysis = await analyzeZoneSupplyDemand(zoneId, serviceId, bucket);
    let status = classifySlotStatus(analysis.status);

    if (analysis.supplyDemandRatio < 0.3) {
      status = SlotIntelligenceStatus.UNAVAILABLE;
    }

    let message: string | undefined;
    if (status === SlotIntelligenceStatus.LIMITED) {
      message = 'Limited availability — consider an alternate time.';
    } else if (status === SlotIntelligenceStatus.AT_RISK) {
      message = 'High demand expected — booking may take longer.';
    } else if (status === SlotIntelligenceStatus.UNAVAILABLE) {
      message = 'This slot is currently unavailable.';
    }

    slots.push({
      time: `${String(hour).padStart(2, '0')}:00`,
      status,
      message,
    });
  }

  return slots;
}

export async function getServiceAvailability(
  serviceId: string,
  query: { zoneId?: string; date?: string },
) {
  if (!query.zoneId) {
    return {
      serviceId,
      available: true,
      slots: [],
      message: 'Select a location to see slot availability.',
    };
  }

  const slots = await getSlotIntelligenceForDay(query.zoneId, serviceId, query.date);
  const hasAvailable = slots.some(
    (s) =>
      s.status === SlotIntelligenceStatus.AVAILABLE || s.status === SlotIntelligenceStatus.LIMITED,
  );

  return {
    serviceId,
    zoneId: query.zoneId,
    available: hasAvailable,
    slots,
    message: hasAvailable ? undefined : 'Limited capacity — try another time or date.',
  };
}
