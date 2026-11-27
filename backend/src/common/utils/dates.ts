import { BUSINESS_UTC_OFFSET_HOURS } from '../constants';

const OFFSET_MS = BUSINESS_UTC_OFFSET_HOURS * 3_600_000;
const DAY_MS = 86_400_000;

/** Midnight at the start of today in the business time zone (Ethiopia), as an exact moment. */
export function startOfBusinessDay(now = new Date()): Date {
  const local = now.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS);
}

/** The first moment of this month in the business time zone. */
export function startOfBusinessMonth(now = new Date()): Date {
  const local = new Date(now.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS);
}

/** "2026-11-08" (a calendar day in the business time zone) as the exact moment that day starts. */
export function businessDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+03:00`);
}

/** A moment as its calendar day in the business time zone, for example "2026-11-08". */
export function formatBusinessDay(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A moment as "2026-11-08 14:35" in the business time zone (used in CSV files). */
export function formatBusinessDateTime(date: Date): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}
