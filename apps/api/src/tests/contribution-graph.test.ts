import { describe, it, expect } from "vitest";

interface DayContribution {
  date: string;
  weekday: number;
  completionCount: number;
  focusSeconds: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function groupDaysIntoWeeks(days: DayContribution[]): DayContribution[][] {
  if (!days || days.length === 0) return [];

  const weeksList: DayContribution[][] = [];
  let currentWeek: DayContribution[] = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeksList.push(currentWeek);
      currentWeek = [];
    }
  });

  return weeksList;
}

function deriveMonthLabels(weeks: DayContribution[][]): Map<number, string> {
  const monthMap = new Map<number, string>();
  if (!weeks || weeks.length === 0) return monthMap;

  let lastLabeledCol = -999;

  weeks.forEach((week, colIdx) => {
    const firstOfMonthDay = week.find((d) => d.date.endsWith("-01"));
    if (firstOfMonthDay) {
      const parts = firstOfMonthDay.date.split("-");
      const monthNum = parseInt(parts[1], 10) - 1;
      if (colIdx - lastLabeledCol >= 3 && colIdx < weeks.length - 1) {
        monthMap.set(colIdx, MONTH_NAMES[monthNum]);
        lastLabeledCol = colIdx;
      }
    }
  });

  if (!monthMap.has(0)) {
    const firstDay = weeks[0]?.[0];
    if (firstDay) {
      const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => a - b);
      const firstLabeledCol = sortedKeys[0];
      if (firstLabeledCol === undefined || firstLabeledCol >= 3) {
        const parts = firstDay.date.split("-");
        const monthNum = parseInt(parts[1], 10) - 1;
        monthMap.set(0, MONTH_NAMES[monthNum]);
      }
    }
  }

  return monthMap;
}

describe("Contribution Graph Unit Tests", () => {
  it("returned week count and grid column count agree for 52 weeks (364 days)", () => {
    const days: DayContribution[] = [];
    // Start on Sunday 2025-10-26
    const baseDate = new Date("2025-10-26T12:00:00Z");
    for (let i = 0; i < 52 * 7; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        weekday: d.getUTCDay(),
        completionCount: 0,
        focusSeconds: 0,
        level: 0,
      });
    }

    const weeks = groupDaysIntoWeeks(days);
    expect(weeks.length).toBe(52);
    // Every week starts on Sunday
    weeks.forEach((w) => {
      expect(w[0].weekday).toBe(0);
    });
  });

  it("month labels correctly handle year boundary (Dec -> Jan)", () => {
    // Generate 10 weeks spanning December 2025 to February 2026
    const days: DayContribution[] = [];
    // Start on Sunday 2025-12-07
    const baseDate = new Date("2025-12-07T12:00:00Z");
    for (let i = 0; i < 10 * 7; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        weekday: d.getUTCDay(),
        completionCount: 0,
        focusSeconds: 0,
        level: 0,
      });
    }

    const weeks = groupDaysIntoWeeks(days);
    const monthLabels = deriveMonthLabels(weeks);

    // Week 0 has 2025-12-07: month label should be "Dec"
    expect(monthLabels.get(0)).toBe("Dec");

    // Week containing 2026-01-01 should be labeled "Jan"
    let janCol: number | undefined;
    weeks.forEach((w, col) => {
      if (w.some((d) => d.date === "2026-01-01")) {
        janCol = col;
      }
    });

    expect(janCol).toBeDefined();
    expect(monthLabels.get(janCol!)).toBe("Jan");
  });

  it("aligns month label with week spanning two months containing the 1st of the month", () => {
    // Week spanning April 26, 2026 to May 2, 2026:
    // Sun Apr 26, Mon Apr 27, Tue Apr 28, Wed Apr 29, Thu Apr 30, Fri May 01, Sat May 02
    const days: DayContribution[] = [];
    const baseDate = new Date("2026-04-05T12:00:00Z"); // Sunday
    for (let i = 0; i < 8 * 7; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        weekday: d.getUTCDay(),
        completionCount: 0,
        focusSeconds: 0,
        level: 0,
      });
    }

    const weeks = groupDaysIntoWeeks(days);
    const monthLabels = deriveMonthLabels(weeks);

    // Week 3 contains 2026-05-01
    const mayWeekIndex = weeks.findIndex((w) => w.some((d) => d.date === "2026-05-01"));
    expect(mayWeekIndex).toBe(3);
    expect(monthLabels.get(mayWeekIndex)).toBe("May");
  });

  it("never places month labels closer than 3 columns apart to prevent overlap", () => {
    const days: DayContribution[] = [];
    const baseDate = new Date("2025-10-26T12:00:00Z");
    for (let i = 0; i < 52 * 7; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        weekday: d.getUTCDay(),
        completionCount: 0,
        focusSeconds: 0,
        level: 0,
      });
    }

    const weeks = groupDaysIntoWeeks(days);
    const monthLabels = deriveMonthLabels(weeks);
    const cols = Array.from(monthLabels.keys()).sort((a, b) => a - b);

    for (let i = 1; i < cols.length; i++) {
      expect(cols[i] - cols[i - 1]).toBeGreaterThanOrEqual(3);
    }
  });
});
