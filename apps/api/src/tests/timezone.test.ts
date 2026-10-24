import { describe, it, expect } from 'vitest';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  splitSegmentByAsiaKolkataDays,
} from '../utils/timezone.js';

describe('Asia/Kolkata Timezone Utilities', () => {
  it('correctly formats date string in Asia/Kolkata timezone (UTC+05:30)', () => {
    // 2026-10-24 00:00:00 in IST is 2026-10-23T18:30:00.000Z
    const date1 = new Date('2026-10-23T18:30:00.000Z');
    expect(getAsiaKolkataDateString(date1)).toBe('2026-10-24');

    // 1 millisecond before midnight in IST is still 2026-10-23
    const dateBefore = new Date('2026-10-23T18:29:59.999Z');
    expect(getAsiaKolkataDateString(dateBefore)).toBe('2026-10-23');

    // Afternoon in IST: 2026-10-24 14:30:00 IST is 2026-10-24T09:00:00.000Z
    const dateAfternoon = new Date('2026-10-24T09:00:00.000Z');
    expect(getAsiaKolkataDateString(dateAfternoon)).toBe('2026-10-24');
  });

  it('calculates correct UTC start and end bounds for an India calendar day', () => {
    const { startUtc, endUtc } = getAsiaKolkataDayBounds('2026-10-24');

    expect(startUtc.toISOString()).toBe('2026-10-23T18:30:00.000Z');
    expect(endUtc.toISOString()).toBe('2026-10-24T18:29:59.999Z');
  });

  describe('splitSegmentByAsiaKolkataDays', () => {
    it('returns a single day entry when work segment is within one India calendar day', () => {
      // 10:00 IST to 10:45 IST on 2026-10-24
      const start = new Date('2026-10-24T04:30:00.000Z');
      const end = new Date('2026-10-24T05:15:00.000Z'); // 45 mins = 2700s

      const result = splitSegmentByAsiaKolkataDays(start, end);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-10-24');
      expect(result[0].seconds).toBe(2700);
    });

    it('accurately splits segment that crosses India midnight boundary', () => {
      // 23:45 IST on 2026-10-24 to 00:30 IST on 2026-10-25
      // 23:45 IST = 18:15 UTC (2026-10-24)
      // 00:30 IST = 19:00 UTC (2026-10-24)
      // Midnight IST occurs at 18:30 UTC
      const start = new Date('2026-10-24T18:15:00.000Z'); // 15 mins before IST midnight
      const end = new Date('2026-10-24T19:00:00.000Z');   // 30 mins after IST midnight

      const result = splitSegmentByAsiaKolkataDays(start, end);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2026-10-24',
        seconds: 900, // 15 minutes
      });
      expect(result[1]).toEqual({
        date: '2026-10-25',
        seconds: 1800, // 30 minutes
      });
    });

    it('returns empty array when end is before or equal to start', () => {
      const now = new Date();
      expect(splitSegmentByAsiaKolkataDays(now, now)).toEqual([]);
    });
  });
});
