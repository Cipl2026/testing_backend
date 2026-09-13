import { createSlotReservation } from '@/modules/provider-availability/reservation.service.js';
import { getAnchorService } from '@/modules/home-help/home-help-catalog.service.js';
import { buildHomeHelpReservationPayload } from '@/modules/home-help/home-help-quote.service.js';
import type { HomeHelpTaskSelection, QuickServicesSnapshot } from '@ghaarfix/shared-types';

export async function createHomeHelpReservation(
  customerId: string,
  input: {
    providerId: string;
    addressId: string;
    startDateTime: string;
    durationPackageId: string;
    tasks: HomeHelpTaskSelection[];
    generalNotes?: string;
    homeId?: string;
    quickServices?: QuickServicesSnapshot;
  },
) {
  const [anchorService, homeHelpPayload] = await Promise.all([
    getAnchorService(),
    buildHomeHelpReservationPayload({
      durationPackageId: input.durationPackageId,
      tasks: input.tasks,
      generalNotes: input.generalNotes,
    }),
  ]);

  return createSlotReservation(customerId, {
    providerId: input.providerId,
    serviceId: anchorService._id.toString(),
    addressId: input.addressId,
    startDateTime: input.startDateTime,
    homeId: input.homeId,
    durationMinutesOverride: homeHelpPayload.durationMinutes,
    homeHelp: homeHelpPayload,
    quickServices: input.quickServices,
  });
}
