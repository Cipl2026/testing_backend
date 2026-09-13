import { Types } from 'mongoose';
import { PaymentMethod, QuickServicesBookingMode } from '@ghaarfix/shared-types';
import {
  HomeHelpRecurringPlan,
  HomeHelpRecurringPlanStatus,
} from '@/models/HomeHelpRecurringPlan.js';
import { createHomeHelpReservation } from '@/modules/home-help/home-help-booking.service.js';
import { createBookingFromReservation } from '@/modules/bookings/booking.service.js';
import { computeNextOccurrence } from '@/modules/home-help/home-help-recurring.service.js';
import { logger } from '@/utils/logger.js';

export async function processDueRecurringOccurrences(): Promise<number> {
  const now = new Date();
  const duePlans = await HomeHelpRecurringPlan.find({
    status: HomeHelpRecurringPlanStatus.ACTIVE,
    nextOccurrenceAt: { $lte: now },
    providerId: { $exists: true, $ne: null },
  }).limit(10);

  let processed = 0;
  for (const plan of duePlans) {
    try {
      const occurrenceAt = plan.nextOccurrenceAt!;
      const locked = await HomeHelpRecurringPlan.findOneAndUpdate(
        {
          _id: plan._id,
          status: HomeHelpRecurringPlanStatus.ACTIVE,
          nextOccurrenceAt: occurrenceAt,
        },
        { $set: { nextOccurrenceAt: null } },
        { new: true },
      );
      if (!locked) continue;

      const tasks = locked.tasks.map((task) => ({
        serviceId: task.serviceId.toString(),
        priority: task.priority,
        notes: task.notes,
      }));

      const reservation = await createHomeHelpReservation(locked.customerId.toString(), {
        providerId: locked.providerId!.toString(),
        addressId: locked.addressId.toString(),
        startDateTime: occurrenceAt.toISOString(),
        durationPackageId: locked.durationPackageId.toString(),
        tasks,
        generalNotes: locked.generalNotes,
        paymentMethod: locked.paymentMethod as PaymentMethod,
        recurringPlanId: locked._id.toString(),
        quickServices: {
          bookingMode: QuickServicesBookingMode.RECURRING,
        },
      });

      const booking = await createBookingFromReservation(locked.customerId.toString(), {
        reservationId: reservation.id,
        paymentMethod: locked.paymentMethod as PaymentMethod,
      });

      const nextOccurrenceAt = computeNextOccurrence(occurrenceAt, locked.recurring);
      locked.lastReservationId = new Types.ObjectId(reservation.id);
      locked.lastBookingId = new Types.ObjectId(booking.id);
      locked.occurrencesCompleted += 1;
      locked.nextOccurrenceAt = nextOccurrenceAt ?? undefined;
      if (!nextOccurrenceAt) {
        locked.status = HomeHelpRecurringPlanStatus.COMPLETED;
      }
      await locked.save();
      processed += 1;
    } catch (error) {
      logger.error('Failed to process recurring Home Help occurrence', {
        planId: plan._id.toString(),
        error,
      });
      await HomeHelpRecurringPlan.findByIdAndUpdate(plan._id, {
        nextOccurrenceAt: plan.nextOccurrenceAt,
      });
    }
  }
  return processed;
}

export async function runHomeHelpRecurringJobs(): Promise<{ occurrences: number }> {
  const occurrences = await processDueRecurringOccurrences();
  if (occurrences > 0) {
    logger.info('Processed Home Help recurring occurrences', { occurrences });
  }
  return { occurrences };
}
