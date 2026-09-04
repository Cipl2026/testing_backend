import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const BUCKET_MINUTES = 15;

export function floorToBucket(date: Date, minutes = BUCKET_MINUTES): Date {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  const floored = Math.floor(dt.minute / minutes) * minutes;
  return dt.set({ minute: floored, second: 0, millisecond: 0 }).toJSDate();
}

export function hourBucket(date: Date): Date {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  return dt.startOf('hour').toJSDate();
}

export function dayBucket(date: Date): Date {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  return dt.startOf('day').toJSDate();
}

export function localDateString(date = new Date(), zone = DEFAULT_TIMEZONE): string {
  return DateTime.fromJSDate(date, { zone }).toISODate()!;
}

export function parseShiftTimes(date: string, startTime: string, endTime: string, zone = DEFAULT_TIMEZONE) {
  const start = DateTime.fromISO(`${date}T${startTime}`, { zone });
  const end = DateTime.fromISO(`${date}T${endTime}`, { zone });
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}

export function shiftsOverlap(
  a: { date: string; startTime: string; endTime: string },
  b: { date: string; startTime: string; endTime: string },
  zone = DEFAULT_TIMEZONE,
): boolean {
  if (a.date !== b.date) return false;
  const left = parseShiftTimes(a.date, a.startTime, a.endTime, zone);
  const right = parseShiftTimes(b.date, b.startTime, b.endTime, zone);
  return left.start < right.end && right.start < left.end;
}
