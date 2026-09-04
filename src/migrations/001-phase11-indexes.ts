import { City } from '@/models/City.js';
import { ServiceZone } from '@/models/ServiceZone.js';
import { ServiceZoneAvailability } from '@/models/ServiceZoneAvailability.js';
import { ProviderCapacity } from '@/models/ProviderCapacity.js';
import { ProviderSlotInventory } from '@/models/ProviderSlotInventory.js';
import { ServiceWaitlist } from '@/models/ServiceWaitlist.js';
import { ZoneDemandMetric } from '@/models/ZoneDemandMetric.js';
import { QueueJobFailure } from '@/models/QueueJobFailure.js';
import { ProviderServiceArea } from '@/models/ProviderServiceArea.js';
import { SlotReservation } from '@/models/SlotReservation.js';
import { Booking } from '@/models/Booking.js';
import { ServiceZoneType } from '@ghaarfix/shared-types';
import { slugify } from '@/utils/catalog.js';
import { logger } from '@/utils/logger.js';

const DEFAULT_CITIES = [
  { name: 'Faridabad', state: 'Haryana', center: { latitude: 28.4089, longitude: 77.3178 } },
  { name: 'Delhi', state: 'Delhi', center: { latitude: 28.6139, longitude: 77.209 } },
  { name: 'Gurgaon', state: 'Haryana', center: { latitude: 28.4595, longitude: 77.0266 } },
  { name: 'Noida', state: 'Uttar Pradesh', center: { latitude: 28.5355, longitude: 77.391 } },
];

async function ensureModelIndexes(): Promise<void> {
  await Promise.all([
    City.syncIndexes(),
    ServiceZone.syncIndexes(),
    ServiceZoneAvailability.syncIndexes(),
    ProviderCapacity.syncIndexes(),
    ProviderSlotInventory.syncIndexes(),
    ServiceWaitlist.syncIndexes(),
    ZoneDemandMetric.syncIndexes(),
    QueueJobFailure.syncIndexes(),
    ProviderServiceArea.syncIndexes(),
    SlotReservation.syncIndexes(),
    Booking.syncIndexes(),
  ]);
}

async function seedDefaultCities(): Promise<number> {
  const count = await City.countDocuments();
  if (count > 0) return 0;

  let seeded = 0;
  for (const cityInput of DEFAULT_CITIES) {
    const city = await City.create({
      name: cityInput.name,
      slug: slugify(cityInput.name),
      state: cityInput.state,
      country: 'IN',
      center: cityInput.center,
      isActive: true,
    });

    await ServiceZone.create({
      name: `${cityInput.name} City Wide`,
      slug: slugify(`${cityInput.name}-city-wide`),
      type: ServiceZoneType.CITY_WIDE,
      cityId: city._id,
      postalCodes: [],
      priority: 0,
      isActive: true,
    });
    seeded += 1;
  }
  return seeded;
}

export async function runPhase11Migrations(): Promise<void> {
  await ensureModelIndexes();
  const seeded = await seedDefaultCities();
  if (seeded > 0) {
    logger.info('Phase 11 migration seeded default cities', { count: seeded });
  }
}
