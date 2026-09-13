import { BookingSource } from '@ghaarfix/shared-types';

export function resolveBookingSource(input: {
  quickServices?: unknown;
  homeHelp?: unknown;
  urgent?: boolean;
}): BookingSource {
  if (input.quickServices) return BookingSource.QUICK_SERVICES;
  if (input.homeHelp) return BookingSource.HOME_HELP;
  if (input.urgent) return BookingSource.URGENT_FIX;
  return BookingSource.SLOT_RESERVATION;
}
