/**
 * Timezone utilities for Asia/Kolkata (IST: UTC+05:30).
 * All persistent records in the database store UTC timestamps.
 * Date boundaries, streaks, and charts are calculated in Asia/Kolkata.
 */

export const ASIA_KOLKATA_TIMEZONE = 'Asia/Kolkata';
export const ASIA_KOLKATA_OFFSET_MS = (5 * 3600 + 30 * 60) * 1000; // +05:30 in ms

/**
 * Returns formatted calendar date string "YYYY-MM-DD" for a given date in Asia/Kolkata.
 */
export function getAsiaKolkataDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ASIA_KOLKATA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns formatted full date & time string in Asia/Kolkata: "YYYY-MM-DD HH:mm:ss"
 */
export function getAsiaKolkataDateTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ASIA_KOLKATA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Given a "YYYY-MM-DD" date string in Asia/Kolkata, returns the UTC start and end Date bounds.
 * e.g. "2026-10-24" in Asia/Kolkata begins at 2026-10-23T18:30:00.000Z and ends at 2026-10-24T18:29:59.999Z.
 */
export function getAsiaKolkataDayBounds(dateString: string): { startUtc: Date; endUtc: Date } {
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // UTC timestamp corresponding to local midnight in Asia/Kolkata
  const localMidnightUtcTimestamp = Date.UTC(year, month, day, 0, 0, 0, 0) - ASIA_KOLKATA_OFFSET_MS;
  const startUtc = new Date(localMidnightUtcTimestamp);
  const endUtc = new Date(localMidnightUtcTimestamp + 24 * 3600 * 1000 - 1);

  return { startUtc, endUtc };
}

/**
 * Splits an active continuous work segment into daily seconds bounded by Asia/Kolkata calendar days.
 * If start and end are on the same India calendar day, returns a single entry.
 * If the segment crosses one or more midnight boundaries, it splits precisely at midnight.
 */
export function splitSegmentByAsiaKolkataDays(
  startUtc: Date,
  endUtc: Date
): Array<{ date: string; seconds: number }> {
  if (startUtc >= endUtc) {
    return [];
  }

  const results: Array<{ date: string; seconds: number }> = [];
  let currentStart = new Date(startUtc);

  while (currentStart < endUtc) {
    const currentDateStr = getAsiaKolkataDateString(currentStart);
    const { endUtc: currentDayEnd } = getAsiaKolkataDayBounds(currentDateStr);

    const segmentEndForDay = endUtc < currentDayEnd ? endUtc : currentDayEnd;
    const durationMs = segmentEndForDay.getTime() - currentStart.getTime();
    const durationSeconds = Math.max(0, Math.round(durationMs / 1000));

    if (durationSeconds > 0) {
      results.push({
        date: currentDateStr,
        seconds: durationSeconds,
      });
    }

    // Move to 1ms past midnight for the next iteration
    currentStart = new Date(currentDayEnd.getTime() + 1);
  }

  return results;
}

/**
 * Returns previous calendar date string "YYYY-MM-DD".
 */
export function getPreviousDateString(dateString: string): string {
  const [y, m, d] = dateString.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns next calendar date string "YYYY-MM-DD".
 */
export function getNextDateString(dateString: string): string {
  const [y, m, d] = dateString.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns weekday index 0 (Sunday) to 6 (Saturday) for a given "YYYY-MM-DD".
 */
export function getWeekdayForDateString(dateString: string): number {
  const [y, m, d] = dateString.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.getUTCDay();
}

