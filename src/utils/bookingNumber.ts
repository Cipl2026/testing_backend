import { randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { Booking } from '@/models/Booking.js';

export async function generateBookingNumber(): Promise<string> {
  const datePart = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyyMMdd');
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    const number = `GF-${datePart}-${suffix}`;
    const exists = await Booking.exists({ bookingNumber: number });
    if (!exists) return number;
  }
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `GF-${datePart}-${suffix}`;
}
