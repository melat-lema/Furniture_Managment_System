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
