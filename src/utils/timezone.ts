import { DateTime } from 'luxon';
import type { DayOfWeek } from '@ghaarfix/shared-types';

const DAY_MAP: Record<number, DayOfWeek> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
};

export function isValidTimezone(timezone: string): boolean {
  try {
    return DateTime.now().setZone(timezone).isValid;
  } catch {
    return false;
  }
}

export function getDayOfWeek(date: string, timezone: string): DayOfWeek {
  const dt = DateTime.fromISO(date, { zone: timezone });
  return DAY_MAP[dt.weekday]!;
}

export function parseTimeOnDate(date: string, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const dt = DateTime.fromISO(date, { zone: timezone }).set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });
  return dt.toUTC().toJSDate();
}

export function formatSlotLabel(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toISODate() ?? '';
}

export function addMinutes(date: Date, minutes: number): Date {
  return DateTime.fromJSDate(date, { zone: 'utc' }).plus({ minutes }).toJSDate();
}

export function startOfDayInTimezone(date: string, timezone: string): Date {
  return DateTime.fromISO(date, { zone: timezone }).startOf('day').toUTC().toJSDate();
}

export function endOfDayInTimezone(date: string, timezone: string): Date {
  return DateTime.fromISO(date, { zone: timezone }).endOf('day').toUTC().toJSDate();
}

export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}
