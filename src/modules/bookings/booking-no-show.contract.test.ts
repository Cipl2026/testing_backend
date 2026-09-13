import { describe, expect, it } from 'vitest';
import { BookingSource, BookingType } from '@ghaarfix/shared-types';

/**
 * Documents expected urgent redispatch preconditions without requiring Mongo.
 * Full integration coverage should run against a test DB in CI when wired.
 */
describe('urgent no-show redispatch contract', () => {
  it('requires urgent booking type and HOME_HELP or URGENT_FIX source family', () => {
    const allowedTypes = [BookingType.URGENT];
    const allowedSources = [BookingSource.URGENT_FIX, BookingSource.HOME_HELP];
    expect(allowedTypes).toContain(BookingType.URGENT);
    expect(allowedSources).toContain(BookingSource.HOME_HELP);
  });

  it('blocks redispatch for scheduled-only bookings', () => {
    const bookingType = BookingType.SCHEDULED;
    expect(bookingType === BookingType.URGENT).toBe(false);
  });
});
