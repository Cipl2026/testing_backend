import { createSlotReservation } from '@/modules/provider-availability/reservation.service.js';
import { getAnchorService } from '@/modules/home-help/home-help-catalog.service.js';
import { buildHomeHelpReservationPayload } from '@/modules/home-help/home-help-quote.service.js';
import { PaymentMethod, type HomeHelpTaskSelection, type QuickServicesSnapshot } from '@ghaarfix/shared-types';
import { createHomeHelpRecurringPlan } from '@/modules/home-help/home-help-recurring.service.js';
import { HomeHelpRecurringPlan } from '@/models/HomeHelpRecurringPlan.js';
import { Types } from 'mongoose';

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
    paymentMethod?: PaymentMethod;
    recurringPlanId?: string;
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

  const reservation = await createSlotReservation(customerId, {
    providerId: input.providerId,
    serviceId: anchorService._id.toString(),
    addressId: input.addressId,
    startDateTime: input.startDateTime,
    homeId: input.homeId,
    durationMinutesOverride: homeHelpPayload.durationMinutes,
    homeHelp: homeHelpPayload,
    quickServices: input.quickServices,
  });

  let recurringPlan: Awaited<ReturnType<typeof createHomeHelpRecurringPlan>> | null = null;
  if (input.quickServices?.recurring && !input.recurringPlanId) {
    recurringPlan = await createHomeHelpRecurringPlan({
      customerId,
      addressId: input.addressId,
      providerId: input.providerId,
      durationPackageId: input.durationPackageId,
      tasks: input.tasks,
      generalNotes: input.generalNotes,
      paymentMethod: input.paymentMethod ?? PaymentMethod.PAY_ON_SERVICE,
      recurring: input.quickServices.recurring,
      reservationId: reservation.id,
    });
  } else if (input.recurringPlanId) {
    await HomeHelpRecurringPlan.findByIdAndUpdate(input.recurringPlanId, {
      lastReservationId: new Types.ObjectId(reservation.id),
    });
  }

  return {
    ...reservation,
    recurringPlanId: recurringPlan?.id,
    nextOccurrenceAt: recurringPlan?.nextOccurrenceAt,
  };
}
