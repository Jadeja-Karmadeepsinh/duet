import { eq, and, lte, gte, desc, or, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  workSessions,
  workSessionSegments,
  taskCompletions,
} from '../db/schema/index.js';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  splitSegmentByAsiaKolkataDays,
  getNextDateString,
  getDateDaysAgo,
  getDaysBetweenDatesInclusive,
} from '../utils/timezone.js';
import { statsService } from './stats.service.js';

export type AnalyticsRange = '7d' | '30d' | '90d' | '1y' | 'lifetime';

export interface TimeSeriesPoint {
  key: string; // "YYYY-MM-DD" or "YYYY-MM"
  label: string; // e.g. "Oct 24" or "Oct 2026"
  focusSeconds: number;
  completionCount: number;
}

export interface CategoryStat {
  category: string;
  focusSeconds: number;
  completionCount: number;
  percentage: number;
}

export interface PriorPeriodComparison {
  priorStartDate: string;
  priorEndDate: string;
  priorTotalFocusSeconds: number;
  priorTotalCompletions: number;
  focusChangePercent: number | null; // null if baseline is 0
  completionsChangePercent: number | null; // null if baseline is 0
}

export interface LongestSessionRecord {
  id: string;
  taskTitle: string;
  category: string | null;
  mode: 'countdown' | 'stopwatch';
  trackedSeconds: number;
  startedAt: Date;
}

export interface AnalyticsSummary {
  totalFocusSeconds: number;
  totalCompletions: number;
  calendarDaysCount: number;
  activeDaysCount: number;
  averageFocusSecondsPerCalendarDay: number;
  averageFocusSecondsPerActiveDay: number;
  mostFocusDay: { date: string; focusSeconds: number } | null;
  mostCompletionsDay: { date: string; completionCount: number } | null;
  currentStreak: number;
  longestStreak: number;
  longestSession: LongestSessionRecord | null;
  priorPeriod: PriorPeriodComparison | null;
}

export interface AnalyticsResponseData {
  range: AnalyticsRange;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  binning: 'daily' | 'monthly';
  summary: AnalyticsSummary;
  timeSeries: TimeSeriesPoint[];
  categories: CategoryStat[];
}

export class AnalyticsService {
  /**
   * Retrieves comprehensive analytics data for the requested range.
   * Scoped strictly to the authenticated user.
   */
  async getAnalytics(userId: string, range: AnalyticsRange): Promise<AnalyticsResponseData> {
    const now = new Date();
    const todayStr = getAsiaKolkataDateString(now);

    // 1. Determine Range Boundaries & Binning
    let startDateStr: string;
    let endDateStr = todayStr;
    let binning: 'daily' | 'monthly' = 'daily';
    let rangeLabel: string;

    if (range === '7d') {
      startDateStr = getDateDaysAgo(todayStr, 6); // 7 days inclusive
      binning = 'daily';
      rangeLabel = 'Last 7 Days';
    } else if (range === '30d') {
      startDateStr = getDateDaysAgo(todayStr, 29); // 30 days inclusive
      binning = 'daily';
      rangeLabel = 'Last 30 Days';
    } else if (range === '90d') {
      startDateStr = getDateDaysAgo(todayStr, 89); // 90 days inclusive
      binning = 'daily';
      rangeLabel = 'Last 90 Days';
    } else if (range === '1y') {
      startDateStr = getDateDaysAgo(todayStr, 364); // Trailing 365 India calendar days inclusive
      binning = 'monthly';
      rangeLabel = 'Last 1 Year (365 Days)';
    } else {
      // Lifetime: find earliest activity date
      const earliestActivityDate = await this.getEarliestActivityDate(userId, todayStr);
      startDateStr = earliestActivityDate;
      const spanDays = getDaysBetweenDatesInclusive(startDateStr, endDateStr);
      binning = spanDays > 90 ? 'monthly' : 'daily';
      rangeLabel = 'Lifetime';
    }

    const { startUtc } = getAsiaKolkataDayBounds(startDateStr);
    const { endUtc } = getAsiaKolkataDayBounds(endDateStr);

    // 2. Fetch Work Session Segments overlapping with the range
    const segments = await db
      .select({
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
        category: workSessions.categorySnapshot,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          eq(workSessions.userId, userId),
          lte(workSessionSegments.startedAt, endUtc),
          or(
            gte(workSessionSegments.endedAt, startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    const dayFocusMap: Record<string, number> = {};
    const categoryFocusMap: Record<string, number> = {};

    for (const seg of segments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : now;
      const effectiveEnd = segEnd > now ? now : segEnd;

      if (segStart < effectiveEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveEnd);
        const categoryKey = seg.category?.trim() || 'Uncategorized';

        for (const item of splits) {
          if (item.date >= startDateStr && item.date <= endDateStr) {
            dayFocusMap[item.date] = (dayFocusMap[item.date] || 0) + item.seconds;
            categoryFocusMap[categoryKey] = (categoryFocusMap[categoryKey] || 0) + item.seconds;
          }
        }
      }
    }

    // 3. Fetch Task Completions in the range
    const completions = await db
      .select({
        id: taskCompletions.id,
        completedAt: taskCompletions.completedAt,
        category: taskCompletions.categorySnapshot,
      })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          gte(taskCompletions.completedAt, startUtc),
          lte(taskCompletions.completedAt, endUtc)
        )
      );

    const dayCompletionMap: Record<string, number> = {};
    const categoryCompletionMap: Record<string, number> = {};

    for (const c of completions) {
      const dateStr = getAsiaKolkataDateString(new Date(c.completedAt));
      dayCompletionMap[dateStr] = (dayCompletionMap[dateStr] || 0) + 1;

      const categoryKey = c.category?.trim() || 'Uncategorized';
      categoryCompletionMap[categoryKey] = (categoryCompletionMap[categoryKey] || 0) + 1;
    }

    // 4. Find Longest Single Focus Session in the range
    const longestSessionRow = await db
      .select({
        id: workSessions.id,
        taskTitle: workSessions.taskTitleSnapshot,
        category: workSessions.categorySnapshot,
        mode: workSessions.mode,
        trackedSeconds: workSessions.trackedSeconds,
        startedAt: workSessions.startedAt,
      })
      .from(workSessions)
      .where(
        and(
          eq(workSessions.userId, userId),
          gte(workSessions.startedAt, startUtc),
          lte(workSessions.startedAt, endUtc)
        )
      )
      .orderBy(desc(workSessions.trackedSeconds))
      .limit(1);

    let longestSession: LongestSessionRecord | null = null;
    if (longestSessionRow.length > 0 && longestSessionRow[0].trackedSeconds > 0) {
      longestSession = longestSessionRow[0];
    }

    // 5. Aggregate Summary Totals
    let totalFocusSeconds = 0;
    for (const sec of Object.values(dayFocusMap)) {
      totalFocusSeconds += sec;
    }

    const totalCompletions = completions.length;
    const calendarDaysCount = getDaysBetweenDatesInclusive(startDateStr, endDateStr);

    const activeDaysSet = new Set<string>();
    for (const [date, sec] of Object.entries(dayFocusMap)) {
      if (sec > 0) activeDaysSet.add(date);
    }
    for (const [date, cnt] of Object.entries(dayCompletionMap)) {
      if (cnt > 0) activeDaysSet.add(date);
    }
    const activeDaysCount = activeDaysSet.size;

    const averageFocusSecondsPerCalendarDay = Math.round(totalFocusSeconds / calendarDaysCount);
    const averageFocusSecondsPerActiveDay =
      activeDaysCount > 0 ? Math.round(totalFocusSeconds / activeDaysCount) : 0;

    // Most focus day & Most completions day
    let mostFocusDay: { date: string; focusSeconds: number } | null = null;
    for (const [d, sec] of Object.entries(dayFocusMap)) {
      if (sec > 0 && (!mostFocusDay || sec > mostFocusDay.focusSeconds)) {
        mostFocusDay = { date: d, focusSeconds: sec };
      }
    }

    let mostCompletionsDay: { date: string; completionCount: number } | null = null;
    for (const [d, count] of Object.entries(dayCompletionMap)) {
      if (count > 0 && (!mostCompletionsDay || count > mostCompletionsDay.completionCount)) {
        mostCompletionsDay = { date: d, completionCount: count };
      }
    }

    // Streaks
    const { currentStreak, bestStreak } = await statsService.calculateStreaks(userId, todayStr);

    // 6. Prior-Period Comparison (Fixed ranges only)
    let priorPeriod: PriorPeriodComparison | null = null;
    if (range !== 'lifetime') {
      priorPeriod = await this.calculatePriorPeriod(
        userId,
        startDateStr,
        calendarDaysCount,
        totalFocusSeconds,
        totalCompletions
      );
    }

    // 7. Time Series Generation
    const timeSeries = this.buildTimeSeries(
      startDateStr,
      endDateStr,
      binning,
      dayFocusMap,
      dayCompletionMap
    );

    // 8. Category Distribution
    const allCategories = new Set([
      ...Object.keys(categoryFocusMap),
      ...Object.keys(categoryCompletionMap),
    ]);

    const categories: CategoryStat[] = Array.from(allCategories)
      .map((cat) => {
        const focusSec = categoryFocusMap[cat] || 0;
        const compCount = categoryCompletionMap[cat] || 0;
        const percentage = totalFocusSeconds > 0 ? Math.round((focusSec / totalFocusSeconds) * 100) : 0;
        return {
          category: cat,
          focusSeconds: focusSec,
          completionCount: compCount,
          percentage,
        };
      })
      .filter((c) => c.focusSeconds > 0 || c.completionCount > 0)
      .sort((a, b) => b.focusSeconds - a.focusSeconds);

    return {
      range,
      rangeLabel,
      startDate: startDateStr,
      endDate: endDateStr,
      binning,
      summary: {
        totalFocusSeconds,
        totalCompletions,
        calendarDaysCount,
        activeDaysCount,
        averageFocusSecondsPerCalendarDay,
        averageFocusSecondsPerActiveDay,
        mostFocusDay,
        mostCompletionsDay,
        currentStreak,
        longestStreak: bestStreak,
        longestSession,
        priorPeriod,
      },
      timeSeries,
      categories,
    };
  }

  /**
   * Helper: Earliest activity date in Asia/Kolkata for lifetime calculation.
   */
  private async getEarliestActivityDate(userId: string, todayStr: string): Promise<string> {
    const [firstSession] = await db
      .select({ startedAt: workSessions.startedAt })
      .from(workSessions)
      .where(eq(workSessions.userId, userId))
      .orderBy(asc(workSessions.startedAt))
      .limit(1);

    const [firstCompletion] = await db
      .select({ completedAt: taskCompletions.completedAt })
      .from(taskCompletions)
      .where(eq(taskCompletions.userId, userId))
      .orderBy(asc(taskCompletions.completedAt))
      .limit(1);

    if (!firstSession && !firstCompletion) {
      return todayStr;
    }

    const sessionDate = firstSession
      ? getAsiaKolkataDateString(new Date(firstSession.startedAt))
      : todayStr;
    const completionDate = firstCompletion
      ? getAsiaKolkataDateString(new Date(firstCompletion.completedAt))
      : todayStr;

    return sessionDate < completionDate ? sessionDate : completionDate;
  }

  /**
   * Helper: Builds daily or monthly time series bins.
   */
  private buildTimeSeries(
    startDateStr: string,
    endDateStr: string,
    binning: 'daily' | 'monthly',
    dayFocusMap: Record<string, number>,
    dayCompletionMap: Record<string, number>
  ): TimeSeriesPoint[] {
    if (binning === 'daily') {
      const points: TimeSeriesPoint[] = [];
      let cur = startDateStr;
      while (cur <= endDateStr) {
        const parts = cur.split('-');
        const monthNum = parseInt(parts[1], 10);
        const dayNum = parseInt(parts[2], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[monthNum - 1]} ${dayNum}`;

        points.push({
          key: cur,
          label,
          focusSeconds: dayFocusMap[cur] || 0,
          completionCount: dayCompletionMap[cur] || 0,
        });
        cur = getNextDateString(cur);
      }
      return points;
    }

    // Monthly binning
    const monthFocusMap: Record<string, number> = {};
    const monthCompletionMap: Record<string, number> = {};

    let cur = startDateStr;
    while (cur <= endDateStr) {
      const monthKey = cur.slice(0, 7); // "YYYY-MM"
      monthFocusMap[monthKey] = (monthFocusMap[monthKey] || 0) + (dayFocusMap[cur] || 0);
      monthCompletionMap[monthKey] =
        (monthCompletionMap[monthKey] || 0) + (dayCompletionMap[cur] || 0);
      cur = getNextDateString(cur);
    }

    const sortedMonths = Object.keys(monthFocusMap).sort();
    return sortedMonths.map((m) => {
      const [yearStr, monthStr] = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(monthStr, 10) - 1;
      const label = `${monthNames[mIdx]} '${yearStr.slice(2)}`;

      return {
        key: m,
        label,
        focusSeconds: monthFocusMap[m] || 0,
        completionCount: monthCompletionMap[m] || 0,
      };
    });
  }

  /**
   * Helper: Calculates accurate prior-period comparison.
   * Only outputs percent change if baseline > 0, avoiding invented percentages.
   */
  private async calculatePriorPeriod(
    userId: string,
    currentStartDateStr: string,
    daysCount: number,
    currentFocusSeconds: number,
    currentCompletions: number
  ): Promise<PriorPeriodComparison> {
    const priorEndStr = getDateDaysAgo(currentStartDateStr, 1);
    const priorStartStr = getDateDaysAgo(priorEndStr, daysCount - 1);

    const { startUtc } = getAsiaKolkataDayBounds(priorStartStr);
    const { endUtc } = getAsiaKolkataDayBounds(priorEndStr);

    // Prior segments
    const priorSegments = await db
      .select({
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          eq(workSessions.userId, userId),
          lte(workSessionSegments.startedAt, endUtc),
          or(
            gte(workSessionSegments.endedAt, startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    let priorTotalFocusSeconds = 0;
    for (const seg of priorSegments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : endUtc;
      const effectiveEnd = segEnd > endUtc ? endUtc : segEnd;

      if (segStart < effectiveEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveEnd);
        for (const item of splits) {
          if (item.date >= priorStartStr && item.date <= priorEndStr) {
            priorTotalFocusSeconds += item.seconds;
          }
        }
      }
    }

    // Prior completions
    const priorCompletions = await db
      .select({ id: taskCompletions.id })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          gte(taskCompletions.completedAt, startUtc),
          lte(taskCompletions.completedAt, endUtc)
        )
      );

    const priorTotalCompletions = priorCompletions.length;

    let focusChangePercent: number | null = null;
    if (priorTotalFocusSeconds > 0) {
      focusChangePercent = Math.round(
        ((currentFocusSeconds - priorTotalFocusSeconds) / priorTotalFocusSeconds) * 100
      );
    }

    let completionsChangePercent: number | null = null;
    if (priorTotalCompletions > 0) {
      completionsChangePercent = Math.round(
        ((currentCompletions - priorTotalCompletions) / priorTotalCompletions) * 100
      );
    }

    return {
      priorStartDate: priorStartStr,
      priorEndDate: priorEndStr,
      priorTotalFocusSeconds,
      priorTotalCompletions,
      focusChangePercent,
      completionsChangePercent,
    };
  }
}

export const analyticsService = new AnalyticsService();
